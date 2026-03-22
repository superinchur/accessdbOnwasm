use tauri::Manager;
use tauri_plugin_shell::{process::CommandChild, ShellExt};

/// Holds the sidecar process handle.
/// Dropping this struct kills the accessdb-bridge process automatically.
/// The field is intentionally "unused" — its purpose is lifetime management.
#[allow(dead_code)]
struct BridgeState(CommandChild);

/// Holds the per-session secret token shared between Tauri and the bridge.
/// CEF TypeScript retrieves this via the `get_bridge_token` Tauri command,
/// then sends it as `X-Bridge-Token` in every bridge request.
struct BridgeToken(String);

/// Expose the bridge token to the Tauri WebView (or native IPC callers).
/// CEF host reads the token from %TEMP%\.accessdb-bridge-token instead.
#[tauri::command]
fn get_bridge_token(state: tauri::State<BridgeToken>) -> String {
    state.0.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Generate a per-session random secret token
            let token = uuid::Uuid::new_v4().to_string();

            // Write token to a well-known temp file so the CEF C++ host can
            // read it at startup and inject it into the TypeScript context.
            // Malicious web pages cannot access the filesystem, so this is safe.
            let token_path = std::env::temp_dir().join(".accessdb-bridge-token");
            std::fs::write(&token_path, &token)?;

            // Spawn the bridge sidecar with the token as an env var
            let (_rx, child) = app
                .shell()
                .sidecar("accessdb-bridge")?
                .env("BRIDGE_TOKEN", &token)
                .env("BRIDGE_PORT", "3456")
                .spawn()?;

            // Managing BridgeState ensures the child process is killed when
            // the Tauri app exits (Drop is called on the CommandChild).
            app.manage(BridgeState(child));
            app.manage(BridgeToken(token));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_bridge_token])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
