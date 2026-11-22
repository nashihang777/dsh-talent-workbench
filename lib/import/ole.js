/**
 * Minimal OLE2 / Compound File Binary reader plus Word 97-2003 (.doc) text
 * extraction. Neither Word nor LibreOffice is required: the piece table in the
 * table stream tells us where the text runs live, and each run is decoded as
 * UTF-16LE or as 8-bit ANSI text (GBK for Chinese documents).
 */

const CFB_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

function readHeader(buffer) {
  if (buffer.length < 512 || !buffer.subarray(0, 8).equals(CFB_SIGNATURE)) {
    throw new Error('不是 OLE 复合文档')
  }
  const sectorShift = buffer.readUInt16LE(0x1e)
  const miniSectorShift = buffer.readUInt16LE(0x20)
  return {
    sectorSize: 2 ** sectorShift,
    miniSectorSize: 2 ** miniSectorShift,
    fatCount: buffer.readUInt32LE(0x2c),
    directoryStart: buffer.readUInt32LE(0x30),
    miniCutoff: buffer.readUInt32LE(0x38),
    miniFatStart: buffer.readUInt32LE(0x3c),
    miniFatCount: buffer.readUInt32LE(0x40),
    difatStart: buffer.readUInt32LE(0x44),
    difatCount: buffer.readUInt32LE(0x48),
  }
}

function sectorOffset(header, sector) {
  return (sector + 1) * header.sectorSize
}

function readSector(buffer, header, sector) {
  const start = sectorOffset(header, sector)
  return buffer.subarray(start, start + header.sectorSize)
}

function buildFat(buffer, header) {
  const fatSectors = []
  for (let index = 0; index < 109; index += 1) {
    const sector = buffer.readUInt32LE(0x4c + index * 4)
    if (sector !== 0xffffffff && sector !== 0xfffffffe) fatSectors.push(sector)
  }
  let difat = header.difatStart
  const perSector = header.sectorSize / 4 - 1
  for (let guard = 0; guard < 1024 && difat !== 0xffffffff && difat !== 0xfffffffe; guard += 1) {
    const data = readSector(buffer, header, difat)
    for (let index = 0; index < perSector; index += 1) {
      const sector = data.readUInt32LE(index * 4)
      if (sector !== 0xffffffff && sector !== 0xfffffffe) fatSectors.push(sector)
    }
    difat = data.readUInt32LE(perSector * 4)
  }
  const entries = []
  for (const sector of fatSectors) {
    const data = readSector(buffer, header, sector)
    for (let offset = 0; offset + 4 <= data.length; offset += 4) entries.push(data.readUInt32LE(offset))
  }
  return entries
}

function chain(fat, start, limit) {
  const sectors = []
  let current = start
  for (let guard = 0; guard < limit && current !== 0xfffffffe && current !== 0xffffffff; guard += 1) {
    sectors.push(current)
    current = fat[current]
    if (current === undefined) break
  }
  return sectors
}

function readStream(buffer, header, fat, entry) {
  const sectors = chain(fat, entry.start, 1_000_000)
  const size = Math.min(entry.size, sectors.length * header.sectorSize)
  const chunks = []
  for (const sector of sectors) chunks.push(readSector(buffer, header, sector))
  return Buffer.concat(chunks).subarray(0, size)
}

function readDirectory(buffer, header, fat) {
  const data = Buffer.concat(chain(fat, header.directoryStart, 1_000_000).map(sector => readSector(buffer, header, sector)))
  const entries = []
  for (let offset = 0; offset + 128 <= data.length; offset += 128) {
    const nameLength = data.readUInt16LE(offset + 0x40)
    const type = data.readUInt8(offset + 0x42)
    if (type === 0) continue
    const name = data.toString('utf16le', offset, offset + Math.max(0, nameLength - 2))
    entries.push({
      name,
      type,
      start: data.readUInt32LE(offset + 0x74),
      size: Number(data.readBigUInt64LE(offset + 0x78)),
    })
  }
  return entries
}

export function readCompoundStreams(buffer) {
  const header = readHeader(buffer)
  const fat = buildFat(buffer, header)
  const directory = readDirectory(buffer, header, fat)
  const root = directory.find(entry => entry.type === 5)
  let miniFat = []
  let miniStream = Buffer.alloc(0)
  if (root !== undefined && header.miniFatStart !== 0xfffffffe && header.miniFatStart !== 0xffffffff) {
    const miniData = Buffer.concat(chain(fat, header.miniFatStart, 100_000).map(sector => readSector(buffer, header, sector)))
    for (let offset = 0; offset + 4 <= miniData.length; offset += 4) miniFat.push(miniData.readUInt32LE(offset))
    miniStream = readStream(buffer, header, fat, root)
  }
  const streams = new Map()
  for (const entry of directory) {
    if (entry.type !== 2 || entry.size === 0) continue
    if (entry.size < header.miniCutoff && miniFat.length > 0) {
      const chunks = []
      let current = entry.start
      for (let guard = 0; guard < 100_000 && current !== 0xfffffffe && current !== 0xffffffff; guard += 1) {
        const start = current * header.miniSectorSize
        chunks.push(miniStream.subarray(start, start + header.miniSectorSize))
        current = miniFat[current]
        if (current === undefined) break
      }
      streams.set(entry.name, Buffer.concat(chunks).subarray(0, entry.size))
    } else {
      streams.set(entry.name, readStream(buffer, header, fat, entry))
    }
  }
  return streams
}

const CONTROL_REPLACEMENTS = new Map([
  [0x07, '\t'],
  [0x0b, '\n'],
  [0x0c, '\n'],
  [0x0d, '\n'],
  [0x0e, ''],
  [0x13, ''],
  [0x14, ''],
  [0x15, ''],
  [0x01, ''],
  [0x02, ''],
  [0x05, ''],
  [0x08, ''],
])

function cleanDocText(text) {
  let output = ''
  for (const character of text) {
    const code = character.codePointAt(0)
    if (CONTROL_REPLACEMENTS.has(code)) {
      output += CONTROL_REPLACEMENTS.get(code)
    } else if (code === 0 || (code < 0x20 && code !== 0x09 && code !== 0x0a)) {
      continue
    } else {
      output += character
    }
  }
  return output
}

function decodeAnsi(bytes) {
  if (bytes.every(byte => byte < 0x80)) return bytes.toString('latin1')
  try {
    const decoded = new TextDecoder('gbk', { fatal: false }).decode(bytes)
    if (decoded.includes('\ufffd')) throw new Error('gbk failed')
    return decoded
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/**
 * Extract text from a Word 97-2003 binary document.
 * Falls back to a loose UTF-16 scan when the piece table cannot be read.
 */
export function docText(buffer) {
  const streams = readCompoundStreams(buffer)
  const word = streams.get('WordDocument')
  if (word === undefined) throw new Error('DOC 中没有 WordDocument 流')
  if (word.length < 0x1aa) throw new Error('DOC 结构过短')
  const flags = word.readUInt16LE(0x0a)
  if ((flags & 0x0100) !== 0) throw new Error('DOC 已加密（设置了打开密码），无法解析文本')
  const tableName = (flags & 0x0200) !== 0 ? '1Table' : '0Table'
  const table = streams.get(tableName) ?? streams.get('0Table') ?? streams.get('1Table')
  const fcMin = word.readUInt32LE(0x18)
  const fcMac = word.readUInt32LE(0x1c)
  const fcClx = word.readUInt32LE(0x01a2)
  const lcbClx = word.readUInt32LE(0x01a6)

  if (table !== undefined && lcbClx > 0 && fcClx + lcbClx <= table.length) {
    const clx = table.subarray(fcClx, fcClx + lcbClx)
    let offset = 0
    while (offset < clx.length && clx[offset] === 0x01) {
      const size = clx.readUInt16LE(offset + 1)
      offset += 3 + size
    }
    if (offset < clx.length && clx[offset] === 0x02) {
      const lcb = clx.readUInt32LE(offset + 1)
      const plc = clx.subarray(offset + 5, offset + 5 + lcb)
      if (plc.length >= 4) {
        const pieces = Math.floor((plc.length - 4) / 12)
        const piecesOffset = 4 * (pieces + 1)
        let text = ''
        for (let index = 0; index < pieces; index += 1) {
          const cpStart = plc.readUInt32LE(index * 4)
          const cpEnd = plc.readUInt32LE((index + 1) * 4)
          const length = cpEnd - cpStart
          if (length <= 0 || length > 2_000_000) continue
          const pcd = plc.subarray(piecesOffset + index * 8, piecesOffset + index * 8 + 8)
          let fc = pcd.readUInt32LE(2)
          const compressed = (fc & 0x40000000) !== 0
          fc &= 0x3fffffff
          if (compressed) {
            const start = fc / 2
            text += decodeAnsi(word.subarray(start, start + length))
          } else {
            text += word.toString('utf16le', fc, fc + length * 2)
          }
        }
        const cleaned = cleanDocText(text)
        if (cleaned.trim() !== '') return cleaned
      }
    }
  }

  // Fallback: the text area between fcMin and fcMac is UTF-16LE for Word 97+.
  if (fcMac > fcMin && fcMac <= word.length) {
    const loose = cleanDocText(word.toString('utf16le', fcMin, fcMac))
    if (loose.trim() !== '') return loose
  }
  throw new Error('无法从该 DOC 中提取文本（可能是加密或非标准格式）')
}
