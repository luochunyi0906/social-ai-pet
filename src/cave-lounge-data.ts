export type LoungePage = { label: string; text: string };
export type LoungeSource = {
  id: string;
  title: string;
  credit: string;
  pages: LoungePage[];
  sample?: true;
};
export type LoungeReference = { sourceId: string; page: number; excerpt?: string };
export type LoungeAnchor = {
  id: string;
  reference: LoungeReference;
  quote: string;
  createdAt: number;
};
export type LoungeDiary = {
  id: string;
  title: string;
  draft: string;
  note: string;
  anchorId: string | null;
  updatedAt: number;
};
export type LoungeRecords = {
  sources: LoungeSource[];
  kept: { sourceId: string; page: number }[];
  anchors: LoungeAnchor[];
  diaries: LoungeDiary[];
  returned: string[];
  delivered: boolean;
};

export const emptyLoungeRecords: LoungeRecords = {
  sources: [], kept: [], anchors: [], diaries: [], returned: [], delivered: false,
};

export const loungeSamples = [
  {
    reason: '基地试读 · 小展台的空间安排',
    source: {
      id: 'display-notes',
      title: '小展台布置笔记',
      credit: '林木 · 布展手记（示例）',
      sample: true,
      pages: [
        { label: '第 1 段 · 入口', text: '入口先留空，让来访的人能停一停，看清展品和通道，再决定往哪边走。桌子沿侧墙摆放，把中间留作连续的走道。' },
        { label: '第 2 段 · 视线', text: '把矮架子放在展台前排，站在入口就能看见后排的展品。需要近看的小物件放在侧墙，再给观众留出转身的位置。' },
        { label: '第 3 段 · 标识', text: '同一区域的标签放在相同高度。先找一位没参与布展的人走一遍，看看哪处需要停下来辨认。' },
      ],
    },
  },
  {
    reason: '基地试读 · 给小空间留一个安静角落',
    source: {
      id: 'reading-corner',
      title: '给小空间留个阅读角',
      credit: '许迟 · 林间札记（示例）',
      sample: true,
      pages: [
        { label: '第 1 段 · 座位', text: '阅读角靠着稳定的墙面，避开主要通道。座位旁放一盏可调方向的灯，够得到的地方留一个平面放杯子和读到一半的书。' },
        { label: '第 2 段 · 书架', text: '常翻的书放在好够到的一层，书背朝外。留一点空位，方便把还没整理的册子先立在那里。' },
      ],
    },
  },
] satisfies { reason: string; source: LoungeSource }[];

let database: Promise<IDBDatabase> | undefined;
const storeName = 'room';
const recordKey = 'records';
function openDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('kanshan-secret-base', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => {
    database = undefined;
    throw error;
  });
}

export async function accessLoungeRecords(update?: (latest: LoungeRecords) => LoungeRecords) {
  const db = await openDatabase();
  return new Promise<LoungeRecords>((resolve, reject) => {
    const transaction = db.transaction(storeName, update ? 'readwrite' : 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(recordKey);
    let result: LoungeRecords;
    request.onsuccess = () => {
      const current = request.result as LoungeRecords | undefined ?? emptyLoungeRecords;
      result = update ? update(current) : current;
      if (update) store.put(result, recordKey);
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export const normalizeClue = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
export const loungeDate = (time: number) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(time);

export async function readLoungeFile(file: File): Promise<LoungeSource> {
  const extension = file.name.toLowerCase().split('.').at(-1);
  if (extension !== 'pdf' && extension !== 'txt' && extension !== 'md' && extension !== 'markdown') {
    throw new Error('请选择 PDF、TXT 或 Markdown 文件。');
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('文件超过 10 MB，请先摘选需要阅读的部分。');
  const data = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', data);
  const id = 'file-' + extension + '-' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  let pages: LoungePage[];
  if (extension === 'pdf') {
    pages = await readPdf(data);
  } else {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch {
      throw new Error('这份文件无法按 UTF-8 读取，请保存为 UTF-8 后再试。');
    }
    pages = text.trim().split(/(?:\r?\n[ \t]*){2,}/).filter(Boolean)
      .map((paragraph, index) => ({ label: '第 ' + (index + 1) + ' 段', text: paragraph }));
  }
  const total = pages.reduce((count, page) => count + page.text.length, 0);
  if (!total) throw new Error('没有找到可阅读的文字。扫描件可先转成文字再打开。');
  if (total > 180_000) throw new Error('正文超过 18 万字，请先摘选需要阅读的部分。');
  return { id, title: file.name, credit: '你打开的本机文件', pages };
}

async function readPdf(data: ArrayBuffer) {
  const [pdf, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.mjs?url&no-inline'),
  ]);
  // Electron opens the renderer from a local file. Use the bundled PDF.js main-thread worker
  // for this bounded text view without creating a blob worker or relaxing the app's CSP.
  const runtime = globalThis as typeof globalThis & { pdfjsWorker?: unknown };
  runtime.pdfjsWorker ??= await import(/* @vite-ignore */ workerUrl);
  const task = pdf.getDocument({ data, disableFontFace: true, useSystemFonts: false, useWasm: false });
  try {
    const document = await task.promise;
    if (document.numPages > 80) throw new Error('PDF 超过 80 页，请先摘选需要阅读的页面。');
    const pages: LoungePage[] = [];
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const text = await page.getTextContent();
      const original = text.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
      pages.push({ label: '第 ' + index + ' 页', text: original });
      page.cleanup();
    }
    return pages;
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('请提供未加密的 PDF 副本。');
    throw error;
  } finally {
    await task.destroy();
  }
}
