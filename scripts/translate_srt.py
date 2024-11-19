import sys
import argostranslate.package
import argostranslate.translate
import os
import re
from pathlib import Path

def setup_translation(from_code, to_code):
    """Set up translation package."""
    argostranslate.package.update_package_index()
    available_packages = argostranslate.package.get_available_packages()
    package_to_install = next(
        filter(
            lambda x: x.from_code == from_code and x.to_code == to_code, 
            available_packages
        ), 
        None
    )
    if not package_to_install:
        raise Exception(f"No translation package found for {from_code} to {to_code}.")
    
    argostranslate.package.install_from_path(package_to_install.download())

def translate_srt(input_path, output_path, from_code, to_code):
    """Translate SRT subtitle file."""
    setup_translation(from_code, to_code)

    with open(input_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()
    len_lines = len(lines)
    len_cutoff = round(len_lines/10)
    translated_lines = []
    for i, line in enumerate(lines):
        # Send progress to stdout
        if i % len_cutoff == 0:
            print(f"{round((i/len_lines)*100, 2)} % translated")
        
        if re.match(r'^\d+$', line.strip()) or '-->' in line:
            # Index or timestamp line
            translated_lines.append(line)
        elif line.strip():
            # Text line
            translated_line = argostranslate.translate.translate(line.strip(), from_code, to_code)
            translated_lines.append(translated_line + '\n')
        else:
            # Blank line
            translated_lines.append(line)

    with open(output_path, 'w', encoding='utf-8') as file:
        file.writelines(translated_lines)

if __name__ == "__main__":
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    source_lang = sys.argv[3]
    target_lang = sys.argv[4]

    translate_srt(input_file, output_file, source_lang, target_lang)
