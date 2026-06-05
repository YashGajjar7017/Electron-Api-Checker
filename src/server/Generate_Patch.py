
import bsdiff4
import os

print("======================================")
print(" ESP32 Firmware Delta Patch Generator ")
print("======================================")

# User Inputs
old_bin = input("Enter OLD BIN path: ").strip('"')
new_bin = input("Enter NEW BIN path: ").strip('"')
patch_file = input("Enter OUTPUT PATCH file path (.patch): ").strip('"')

# Validate files
if not os.path.exists(old_bin):
    print(f"[ERROR] Old bin not found: {old_bin}")
    exit()

if not os.path.exists(new_bin):
    print(f"[ERROR] New bin not found: {new_bin}")
    exit()

try:
    print("\nGenerating patch...")

    bsdiff4.file_diff(old_bin, new_bin, patch_file)

    old_size = os.path.getsize(old_bin)
    new_size = os.path.getsize(new_bin)
    patch_size = os.path.getsize(patch_file)

    print("\n========== SUCCESS ==========")
    print(f"Old BIN Size   : {old_size / 1024:.2f} KB")
    print(f"New BIN Size   : {new_size / 1024:.2f} KB")
    print(f"Patch Size     : {patch_size / 1024:.2f} KB")
    print(f"Patch Generated: {patch_file}")
    print("=============================")

except Exception as e:
    print(f"[ERROR] {e}")