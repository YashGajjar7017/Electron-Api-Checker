import sys
import serial
import threading
import argparse

def read_from_serial(ser):
    while True:
        try:
            if ser.in_waiting > 0:
                # Read whatever is available
                data = ser.read(ser.in_waiting)
                # Decode bytes to string, replacing errors to prevent crashes
                text = data.decode('utf-8', errors='replace')
                sys.stdout.write(text)
                sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"\nError reading from serial: {str(e)}\n")
            sys.stderr.flush()
            break

def main():
    parser = argparse.ArgumentParser(description="Serial Monitor Helper")
    parser.add_argument("--port", required=True, help="Serial port to connect to")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate for connection")
    args = parser.parse_args()

    try:
        # Open serial port
        ser = serial.Serial(args.port, args.baud, timeout=0.1)
        sys.stdout.write(f"Connected to {args.port} at {args.baud} baud.\n")
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"Failed to connect to {args.port}: {str(e)}\n")
        sys.stderr.flush()
        sys.exit(1)

    # Start read thread
    read_thread = threading.Thread(target=read_from_serial, args=(ser,), daemon=True)
    read_thread.start()

    # Read from stdin to send data to the serial port
    try:
        for line in sys.stdin:
            if not line:
                break
            # Strip trailing newline if any, or pass as is
            cmd = line.strip()
            if cmd == "__EXIT__":
                sys.stdout.write("Exiting serial monitor.\n")
                sys.stdout.flush()
                break
            # Write to serial
            ser.write((cmd + '\r\n').encode('utf-8', errors='replace'))
    except Exception as e:
        sys.stderr.write(f"Error writing to serial: {str(e)}\n")
        sys.stderr.flush()
    finally:
        ser.close()

if __name__ == "__main__":
    main()
