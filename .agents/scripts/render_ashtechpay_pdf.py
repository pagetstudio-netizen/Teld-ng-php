import fitz
from pathlib import Path
pdf = Path('attached_assets/AshtechPay_API_Direct_v1_(1)_1787436464915.pdf')
out = Path('.agents/outputs/ashtechpay-pages')
out.mkdir(parents=True, exist_ok=True)
doc = fitz.open(pdf)
print(f'pages={len(doc)}')
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    path = out / f'page-{i+1}.png'
    pix.save(path)
    print(path)
