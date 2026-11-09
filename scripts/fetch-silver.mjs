import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const parsePrice = (str) => {
  if (!str) return null;
  const numStr = str.replace(/[^0-9]/g, '');
  return numStr ? parseInt(numStr, 10) : null;
};

async function fetchSilverPrices() {
  const url = `https://giabac.phuquygroup.vn/PhuQuyPrice/SilverPricePartial?_=${Date.now()}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/html, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();
    let results = [];

    try {
      const json = JSON.parse(text);
      if (Array.isArray(json)) results = json;
    } catch (e) {
      const $ = cheerio.load(text);
      $('table tbody tr').each((index, element) => {
        const tds = $(element).find('td');
        if (tds.length >= 3) {
          const san_pham = $(tds[0]).text().trim();
          const gia_mua = $(tds[1]).text().trim();
          const gia_ban = $(tds[2]).text().trim();
          
          if (san_pham) {
            results.push({
              thuong_hieu: "Phú Quý",
              san_pham: san_pham.replace(/\n/g, ' ').replace(/\s{2,}/g, ' '),
              don_vi: san_pham.toLowerCase().includes('kilo') ? 'VNĐ/Kg' : 'VNĐ/Lượng',
              gia_mua_vao: parsePrice(gia_mua),
              gia_ban_ra: parsePrice(gia_ban)
            });
          }
        }
      });
    }

    // Đảm bảo thư mục docs tồn tại trước khi ghi file
    const outputDir = 'docs';
    if (!fs.existsSync(outputDir)){
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Xuất ra file docs/silver-prices.json để đồng bộ với file vàng
    fs.writeFileSync(path.join(outputDir, 'silver-prices.json'), JSON.stringify(results, null, 2), 'utf-8');
    console.log('✅ Cập nhật giá bạc thành công:', results.length, 'sản phẩm.');

  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu bạc:", error.message);
    process.exit(1); // Để GitHub Action báo lỗi nếu fetch thất bại
  }
}

fetchSilverPrices();
