# crowd_app.py
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import time
import threading
import json
import logging
from typing import Optional

import numpy as np
import cv2
from ultralytics import YOLO
from flask import Flask, Response, stream_with_context
from flask_cors import CORS

# CONFIG
VIDEO_SOURCE = 0               # change to the camera index / url for Feed1
MODEL_NAME = "yolov8n.pt"
CONF_THRESHOLD = 0.45
OVER_CROWD_THRESHOLD = 20
MJPEG_FPS = 10

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
app = Flask(__name__)
CORS(app)

latest_frame_jpeg: Optional[bytes] = None
latest_count = 0
latest_lock = threading.Lock()
stop_event = threading.Event()

def video_worker():
    global latest_frame_jpeg, latest_count
    try:
        logging.info("Loading YOLO model: %s", MODEL_NAME)
        model = YOLO(MODEL_NAME)
    except Exception:
        logging.exception("Failed to load YOLO model.")
        return

    cap = cv2.VideoCapture(VIDEO_SOURCE)
    if not cap.isOpened():
        logging.error("Could not open video source: %s", VIDEO_SOURCE)
        return

    logging.info("Feed1 (crowd) worker started.")
    while not stop_event.is_set():
        ret, frame = cap.read()
        if not ret or frame is None:
            time.sleep(0.05)
            continue

        try:
            results = model.track(frame, persist=True, conf=CONF_THRESHOLD, classes=0, verbose=False)
        except Exception:
            try:
                results = model.predict(frame, conf=CONF_THRESHOLD, classes=[0])
            except Exception:
                logging.exception("Model inference failed; skipping frame.")
                time.sleep(0.05)
                continue

        boxes = getattr(results[0], "boxes", None)
        person_count = len(boxes) if boxes is not None else 0

        try:
            annotated = results[0].plot()
        except Exception:
            annotated = frame

        ok, jpeg = cv2.imencode(".jpg", annotated)
        if ok:
            with latest_lock:
                latest_frame_jpeg = jpeg.tobytes()
                latest_count = person_count

        time.sleep(1.0 / MJPEG_FPS)

    cap.release()
    logging.info("Feed1 worker stopped.")

def mjpeg_generator():
    placeholder = (220 * np.ones((480, 640, 3), dtype=np.uint8)).astype(np.uint8)
    ok, pjpg = cv2.imencode(".jpg", placeholder)
    placeholder_bytes = pjpg.tobytes() if ok else b""

    while not stop_event.is_set():
        with latest_lock:
            frame = latest_frame_jpeg
        if frame is None:
            frame = placeholder_bytes
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
        time.sleep(1.0 / MJPEG_FPS)

@app.route("/video_feed")
def video_feed():
    return Response(stream_with_context(mjpeg_generator()),
                    mimetype="multipart/x-mixed-replace; boundary=frame")

@app.route("/count_stream")
def count_stream():
    def event_stream():
        last_payload = None
        while not stop_event.is_set():
            with latest_lock:
                c = latest_count
            payload = {"count": c, "overcrowd": c > OVER_CROWD_THRESHOLD}
            if payload != last_payload:
                yield f"data: {json.dumps(payload)}\n\n"
                last_payload = payload
            time.sleep(0.5)
    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")

@app.route("/health")
def health():
    with latest_lock:
        return {"status": "ok", "count": latest_count}

if __name__ == "__main__":
    t = threading.Thread(target=video_worker, daemon=True)
    t.start()
    try:
        # run on port 5001
        app.run(host="0.0.0.0", port=5001, threaded=True)
    finally:
        stop_event.set()
        t.join(timeout=2)
