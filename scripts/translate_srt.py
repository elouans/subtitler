import sys
import json
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

def send_progress_update(progress, status='translating'):
    """
    Send progress update to stdout in a JSON format 
    that can be parsed by an API or external process.
    """
    progress_data = {
        'progress': round(progress, 2),
        'status': status
    }
    print(json.dumps(progress_data), flush=True)

def translate_srt(input_path, output_path, from_code, to_code):
    """Translate SRT subtitle file with progress updates."""
    # Initial setup progress
    send_progress_update(0, 'starting')
    
    setup_translation(from_code, to_code)
    send_progress_update(5, 'translation package ready')

    # Read input file
    with open(input_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()
    
    len_lines = len(lines)
    len_cutoff = max(1, round(len_lines/10))  # Avoid division by zero
    translated_lines = []

    # Translation progress
    for i, line in enumerate(lines):
        # Progress update
        progress = (i / len_lines) * 90 + 5  # 90% of progress is translation
        if i % len_cutoff == 0:
            send_progress_update(progress)
        
        if re.match(r'^\d+$', line.strip()) or '-->' in line:
            # Index or timestamp line
            translated_lines.append(line)
        elif line.strip():
            # Text line
            try:
                translated_line = argostranslate.translate.translate(line.strip(), from_code, to_code)
                translated_lines.append(translated_line + '\n')
            except Exception as e:
                # If translation fails, keep original line
                translated_lines.append(line)
        else:
            # Blank line
            translated_lines.append(line)

    # Write output file
    send_progress_update(95, 'writing output')
    with open(output_path, 'w', encoding='utf-8') as file:
        file.writelines(translated_lines)

    # Completion
    send_progress_update(100, 'completed')

if __name__ == "__main__":
    # Validate input arguments
    if len(sys.argv) != 5:
        print(json.dumps({
            'error': 'Invalid arguments', 
            'usage': 'script.py <input_file> <output_file> <source_lang> <target_lang>'
        }))
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    source_lang = sys.argv[3]
    target_lang = sys.argv[4]

    try:
        translate_srt(input_file, output_file, source_lang, target_lang)
    except Exception as e:
        # Send error as JSON
        print(json.dumps({
            'status': 'error',
            'message': str(e)
        }))
        sys.exit(1)