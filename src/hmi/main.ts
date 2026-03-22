import { loadScreen } from './screen-host'
import { showPopup } from './popup'
import { DbSource } from './sources/db-source'
import { ShmSource } from './sources/shm-source'
// import { WsSource }  from './sources/ws-source'   // 필요 시 추가
// import { MqttSource } from './sources/mqtt-source' // 필요 시 추가
import './hmi.css'

const params   = new URLSearchParams(location.search)
const file     = params.get('file')     ?? 'D:\\system_bak.accdb'
const screen   = params.get('screen')  ?? './screens/plant1.svg'
const interval = parseInt(params.get('interval') ?? '2000', 10)
const shmName  = params.get('shm')     ?? ''

const sources = [
  new DbSource(file, 'SELECT TAG_ID, VALUE FROM TAG_MST'),
  ...(shmName ? [new ShmSource(shmName)] : []),
  // new WsSource('ws://localhost:8080/tags'),
]

loadScreen(screen, {
  sources,
  pollInterval: interval,
  onTagClick: (tagId, value) => showPopup(tagId, value, file),
}).catch(err => {
  const el = document.getElementById('hmi-screen')
  if (el) el.innerHTML = `<p style="color:red;padding:20px">${err.message}</p>`
})
