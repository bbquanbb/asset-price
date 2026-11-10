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
      
      // Duyệt qua từng dòng trong tbody của bảng
      $('table tbody tr').each((index, element) => {
        const tds = $(element).find('td');
        
        // Bảng của Phú Quý có 4 cột: Sản phẩm (0), Đơn vị (1), Giá mua vào (2), Giá bán ra (3)
        if (tds.length >= 4) {
          const san_pham = $(tds[0]).text().trim();
          const don_vi = $(tds[1]).text().trim(); // Bỏ qua vì đã hardcode bên dưới hoặc dùng lại
          const gia_mua = $(tds[2]).text().trim();
          const gia_ban = $(tds[3]).text().trim();
          
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

    const outputDir = 'docs';
    if (!fs.existsSync(outputDir)){
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(path.join(outputDir, 'silver-prices.json'), JSON.stringify(results, null, 2), 'utf-8');
    console.log('✅ Cập nhật giá bạc thành công:', results.length, 'sản phẩm.');

  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu bạc:", error.message);
    process.exit(1); 
  }
}

fetchSilverPrices();
