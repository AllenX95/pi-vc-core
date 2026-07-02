# PaddleOCR Provider

PaddleOCR is an optional OCR provider. It is not bundled into `pi-vc-core`.

Current behavior:

- scanned PDF detection returns a warning in the first implementation;
- future OCR adapters should call a local `paddleocr` command when available;
- missing OCR dependencies must not break workspace, Office parsing, or memory capture.

Check:

```bash
paddleocr --help
```

Install for a simple CPU-oriented local setup:

```bash
python -m pip install --upgrade pip
python -m pip install paddlepaddle paddleocr
```

PaddleOCR/PaddlePaddle installation can vary by Python version, CPU/GPU choice, and CUDA environment. If the commands above fail, follow the official PaddlePaddle and PaddleOCR install guides for the target machine.

Use `/vc-doctor` to confirm whether the command is available to Pi.
