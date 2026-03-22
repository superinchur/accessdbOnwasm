/**
 * Windows Named Shared Memory reader (Bun FFI)
 *
 * C++ 앱이 공유메모리에 JSON 문자열을 씁니다:
 *
 *   HANDLE h = CreateFileMappingA(
 *     INVALID_HANDLE_VALUE, NULL, PAGE_READWRITE, 0, 4096, "MyAppSHM");
 *   LPVOID p = MapViewOfFile(h, FILE_MAP_WRITE, 0, 0, 4096);
 *   const char* json = "{\"PUMP_001_STATUS\":\"RUN\",\"PUMP_001_SPEED\":\"1500\"}";
 *   memcpy(p, json, strlen(json) + 1);  // null-terminated
 *
 * 브리지에서 GET /shm?name=MyAppSHM&size=4096 으로 읽습니다.
 */
import { dlopen, FFIType } from 'bun:ffi'

const FILE_MAP_READ = 0x0004

const kernel32 = dlopen('kernel32', {
  OpenFileMappingA: {
    args: [FFIType.u32, FFIType.bool, FFIType.cstring],
    returns: FFIType.ptr,
  },
  MapViewOfFile: {
    args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.u32, FFIType.usize],
    returns: FFIType.ptr,
  },
  UnmapViewOfFile: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
  CloseHandle: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
})

/**
 * 공유메모리에서 JSON 태그맵을 읽어 반환합니다.
 * @param name  CreateFileMappingA에서 사용한 이름 (예: "MyAppSHM")
 * @param size  매핑 크기 (bytes, 기본 4096)
 */
export function readSharedMemoryTags(
  name: string,
  size = 4096,
): Record<string, string> {
  const nameBuf = Buffer.from(name + '\0')

  const handle = kernel32.symbols.OpenFileMappingA(FILE_MAP_READ, false, nameBuf)
  if (!handle) throw new Error(`OpenFileMappingA failed — "${name}" 공유메모리가 없거나 접근 불가`)

  const view = kernel32.symbols.MapViewOfFile(handle, FILE_MAP_READ, 0, 0, size)
  if (!view) {
    kernel32.symbols.CloseHandle(handle)
    throw new Error(`MapViewOfFile failed — "${name}"`)
  }

  try {
    // 포인터 주소에서 Uint8Array 생성 후 null-terminator까지 읽기
    const raw = Buffer.from(Bun.unsafe.arrayBufferFromPtr(view as unknown as number, size))
    const nullIdx = raw.indexOf(0)
    const jsonStr = raw.subarray(0, nullIdx >= 0 ? nullIdx : size).toString('utf8')
    return JSON.parse(jsonStr) as Record<string, string>
  } catch (e) {
    throw new Error(`공유메모리 파싱 실패 — "${name}": ${(e as Error).message}`)
  } finally {
    kernel32.symbols.UnmapViewOfFile(view)
    kernel32.symbols.CloseHandle(handle)
  }
}
