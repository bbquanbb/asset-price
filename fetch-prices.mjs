// Lấy giá vàng mới nhất (vàng miếng, vàng nhẫn) của từng nhà cung cấp và ghi ra docs/prices.json.
// Chạy thử: node scripts/fetch-prices.mjs   (cần Node 20 trở lên, không cần cài thư viện)
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const OUT = 'docs/prices.json';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36'; // TODO: điền email thật
const PROVIDERS = [
  ['sjc', 'SJC'],
  ['doji', 'DOJI'],
  ['pnj', 'PNJ'],
  ['bao-tin-minh-chau', 'Bảo Tín Minh Châu'],
  ['phu-quy', 'Phú Quý'],
  ['mi-hong', 'Mi Hồng'],
];

// Biến HTML thành chữ thường, gọn khoảng trắng.
export const toText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

// Trang ghi giá theo đơn vị x1000đ/lượng, ví dụ "136.500" nghĩa là 136.500.000 đ/lượng.
const toVnd = (s) => Number(s.replace(/\./g, '')) * 1000;

// Tìm khối "Giá vàng Miếng ... Mua vào X ... Bán ra Y" (hoặc "Giá vàng Nhẫn ...").
export function pick(text, label) {
  const re = new RegExp(
    `${label}.{0,80}?Mua vào\\s+(\\d{1,3}(?:\\.\\d{3})+).{0,120}?Bán ra\\s+(\\d{1,3}(?:\\.\\d{3})+)`
  );
  const m = text.match(re);
  if (!m) return null;
  const buy = toVnd(m[1]);
  const sell = toVnd(m[2]);
  if (!(buy > 1e7 && sell >= buy)) return null; // kiểm tra hợp lý
  return { buy, sell };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let old = {};
  try {
    old = JSON.parse(await readFile(OUT, 'utf8')).prices ?? {};
  } catch {}

  const prices = {};
  let ok = 0;
  for (const [slug, name] of PROVIDERS) {
    try {
      const res = await fetch(`https://giavang.org/trong-nuoc/${slug}/`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = toText(await res.text());
      const mieng = pick(text, 'Giá vàng Miếng');
      const nhan = pick(text, 'Giá vàng Nhẫn');
      if (!mieng && !nhan) throw new Error('không đọc được giá nào');
      const sourceUpdatedAt = text.match(/Cập nhật lúc (\d{2}:\d{2}:\d{2} \d{2}\/\d{2}\/\d{4})/)?.[1] ?? null;
      prices[slug] = { name, mieng, nhan, sourceUpdatedAt, stale: false };
      ok++;
    } catch (e) {
      console.error(`[${slug}] lỗi: ${e.message}`);
      if (old[slug]) prices[slug] = { ...old[slug], stale: true }; // giữ giá cũ, đánh dấu cũ
    }
    await sleep(1500); // không dồn dập vào máy chủ nguồn
  }

  if (ok === 0) {
    console.error('Tất cả nhà cung cấp đều lỗi. Không ghi file.');
    process.exit(1); // làm workflow thất bại để GitHub gửi email báo lỗi
  }

  // Chỉ ghi file khi giá thay đổi, để lịch sử commit không bị rối.
  if (JSON.stringify(prices) === JSON.stringify(old)) {
    console.log('Không có thay đổi.');
    return;
  }
  await mkdir('docs', { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({ updatedAt: new Date().toISOString(), source: 'giavang.org', unit: 'VND/luong', prices }, null, 2) + '\n'
  );
  console.log(`Đã cập nhật ${ok}/${PROVIDERS.length} nhà cung cấp.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
