#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF写字表提取工具
从人教版语文教材PDF中提取最后几页的写字表
"""

import sys
import json
import re
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("需要安装 pdfplumber: pip install pdfplumber")
    sys.exit(1)


def extract_text_from_pdf(pdf_path, start_page=None, end_page=None):
    """提取PDF指定页面的文本"""
    words_data = []
    
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        print(f"PDF总页数: {total_pages}")
        
        # 默认提取最后10页
        if start_page is None:
            start_page = max(1, total_pages - 9)
        if end_page is None:
            end_page = total_pages
        
        print(f"提取范围: 第 {start_page} 页到第 {end_page} 页")
        
        for page_num in range(start_page - 1, end_page):  # pdfplumber从0开始
            page = pdf.pages[page_num]
            text = page.extract_text()
            
            if text:
                print(f"\n=== 第 {page_num + 1} 页内容预览 ===")
                print(text[:500])  # 只显示前500字符
                
                # 尝试提取表格
                tables = page.extract_tables()
                if tables:
                    print(f"发现 {len(tables)} 个表格")
                    for i, table in enumerate(tables):
                        print(f"\n表格 {i+1} 预览:")
                        for row in table[:5]:  # 只显示前5行
                            print(row)
            
            words_data.append({
                "page": page_num + 1,
                "text": text,
                "tables": page.extract_tables() if page.extract_tables() else []
            })
    
    return words_data, total_pages


def parse_words_from_text(text):
    """从文本中提取生字和拼音"""
    words = []
    
    # 匹配汉字和拼音的模式
    # 例如: "人 rén" 或 "人(rén)"
    patterns = [
        r'([\u4e00-\u9fa5]+)\s*[（(]?([a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+)[）)]?',
        r'([\u4e00-\u9fa5]+)\s+([a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+)',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            word = match[0] if isinstance(match, tuple) else match
            pinyin = match[1] if isinstance(match, tuple) and len(match) > 1 else ""
            if word and len(word) == 1:  # 只取单字
                words.append({"word": word, "pinyin": pinyin})
    
    return words


def main():
    pdf_path = Path(__file__).parent / "upload" / "【人教版】三年级上册语文电子课本 (1).pdf"
    
    if not pdf_path.exists():
        print(f"错误: 找不到PDF文件 {pdf_path}")
        sys.exit(1)
    
    print("开始分析PDF文件...")
    print(f"文件路径: {pdf_path}")
    
    # 提取文本和表格
    words_data, total_pages = extract_text_from_pdf(pdf_path)
    
    # 输出到JSON文件
    output_file = pdf_path.parent.parent / "extracted_words.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            "source": str(pdf_path.name),
            "total_pages": total_pages,
            "extracted_pages": len(words_data),
            "pages": words_data
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 提取完成，结果已保存到: {output_file}")
    print("\n下一步: 检查提取的内容，然后编写更精确的解析逻辑")


if __name__ == "__main__":
    main()
