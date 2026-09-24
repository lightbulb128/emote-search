import os
import re

target_extension = ".gif"

def do_file(directory, filename):
    '''
    For file name like
    爱丽丝Av1_RedPacket 1_2026-04-16-00-44-45
    -> RedPacket 1.gif
    '''
    match = re.search(r'.*\d+_(.+)_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}', filename[:-len(target_extension)])
    if match:
        new_name = match.group(1) + target_extension
        old_path = os.path.join(directory, filename)
        new_path = os.path.join(directory, new_name)
        print(f"Renaming {old_path} to {new_path}")
        try:
            os.rename(old_path, new_path)
        except Exception as e:
            print(f"Error renaming file {old_path} to {new_path}: {e}")
    else:
        print(f"Filename does not match expected pattern: {filename}")


def rename_files(directory):
    for file in os.listdir(directory):
        if file.endswith(target_extension):
            do_file(directory, file)

if __name__ == "__main__":
    # change encoding to UTF-8
    os.environ["PYTHONIOENCODING"] = "utf-8"
    os.environ["PYTHONLEGACYWINDOWSSTDIO"] = "1"

    dir = r"C:\Codes\tmp\emotelab-query\public\emotes\shinki"
    rename_files(dir)
