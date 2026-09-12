import fitz
from pathlib import Path
pdf = Path('attached_assets/AshtechPay_API_Direct_v1_(1)_1787415688760.pdf')
out = Path('.agents/outputs/ashtechpay-pages')
out.mkdir(parents=True, exist_ok=True)
doc = fitz.open(pdf)
print('pages', doc.page_count)
print('metadata', doc.metadata)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    path = out / f'page-{i+1:02d}.png'
    pix.save(path)
    text = page.get_text('text')
    print(f'page {i+1}: {len(text)} chars -> {path}')
