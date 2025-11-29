# gender_app.py
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import json

import time
import threading
import logging
from typing import Optional

import numpy as np
import cv2
from ultralytics import YOLO
from flask import Flask, Response, stream_with_context, jsonify
from flask_cors import CORS

# CONFIG
FEED_SOURCE = 0                      # change to the camera index / url for Feed2
DETECT_MODEL = "yolov8n.pt"
GENDER_MODEL = "runs/classify/gender_cls6/weights/best.pt"
CONF_THRESHOLD = 0.45
MJPEG_FPS = 8
GENDER_SKIP_FRAMES = 2
GENDER_BATCH_SIZE = 6
GENDER_INPUT_SIZE = 224

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
app = Flask(__name__)
CORS(app)

latest_frame_jpeg = None
latest_women_count = 0
latest_male_present = False
frame_lock = threading.Lock()
stop_event = threading.Event()

def load_models():
    detect = None
    gender = None
    try:
        detect = YOLO(DETECT_MODEL)
        logging.info("Loaded detection model")
    except Exception:
        logging.exception("Failed loading detection model")

    if os.path.exists(GENDER_MODEL):
        try:
            gender = YOLO(GENDER_MODEL)
            logging.info("Loaded gender model: %s", getattr(gender, "names", None))
        except Exception:
            logging.exception("Failed loading gender model")
            gender = None
    else:
        logging.warning("Gender model file not found: %s", GENDER_MODEL)

    return detect, gender

def camera_worker(detect_model: Optional[YOLO], gender_model: Optional[YOLO], src=FEED_SOURCE):
    global latest_frame_jpeg, latest_women_count, latest_male_present

    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        logging.error("Camera failed to open")
        return

    logging.info(f"Gender worker started: {src}")
    frame_idx = 0

    while not stop_event.is_set():
        ret, frame = cap.read()
        if not ret or frame is None:
            time.sleep(0.05)
            continue

        frame_idx += 1
        annotated = frame.copy()
        women_count = 0
        male_present = False

        # detect people
        try:
            r = detect_model.predict(frame, conf=CONF_THRESHOLD, classes=[0], verbose=False)[0]
        except Exception:
            r = None

        boxes = getattr(r, "boxes", None)
        crops, crop_bboxes = [], []

        if boxes is not None and len(boxes) > 0:
            try:
                xyxy = boxes.xyxy.cpu().numpy()
            except Exception:
                xyxy = []
            for b in xyxy:
                x1, y1, x2, y2 = map(int, b[:4])
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(frame.shape[1]-1, x2), min(frame.shape[0]-1, y2)
                if x2 <= x1 or y2 <= y1: continue
                crop = frame[y1:y2, x1:x2]
                if crop.size > 0:
                    crops.append(crop); crop_bboxes.append((x1,y1,x2,y2))

        # classify crops in batches (only every N frames)
        preds = [None] * len(crops)
        if gender_model is not None and len(crops) > 0 and (frame_idx % GENDER_SKIP_FRAMES == 0):
            batched = []
            for i in range(0, len(crops), GENDER_BATCH_SIZE):
                batch = crops[i:i+GENDER_BATCH_SIZE]
                try:
                    out = gender_model.predict(source=batch, imgsz=GENDER_INPUT_SIZE, conf=0.0, half=True, verbose=False)
                    batched.extend(out)
                except Exception:
                    logging.exception("Batch classification failed")
                    batched.extend([None]*len(batch))
            preds = batched

        # Draw only MALE or FEMALE with accuracy
        for (x1,y1,x2,y2), pred in zip(crop_bboxes, preds):
            if pred is None or not hasattr(pred, "probs"):
                continue

            probs = pred.probs
            top_idx = None; top_conf = None

            # try probs.top1/top1conf
            try:
                if hasattr(probs, "top1") and hasattr(probs, "top1conf"):
                    top_idx = int(probs.top1)
                    top_conf = float(probs.top1conf)
            except Exception:
                top_idx = None

            if top_idx is None:
                try:
                    arr = probs.cpu().numpy().flatten()
                    if arr.size == 1:
                        male_prob = float(arr[0]); top_idx = 1 if male_prob >= 0.5 else 0; top_conf = male_prob
                    else:
                        top_idx = int(np.argmax(arr)); top_conf = float(np.max(arr))
                except Exception:
                    top_idx = None

            if top_idx is None:
                continue

            names = getattr(gender_model, "names", None)
            acc_text = f"{(top_conf*100):.1f}%" if top_conf is not None else ""

            if names is not None and top_idx in names:
                name = str(names[top_idx]).lower()
                is_male = name.startswith("m")
            else:
                is_male = (top_idx == 1)

            if is_male:
                color = (0,0,255)
                label = "MALE"
                male_present = True
            else:
                color = (0,255,0)
                label = "FEMALE"
                women_count += 1

            cv2.rectangle(annotated, (x1,y1), (x2,y2), color, 2)
            cv2.putText(annotated, f"{label} {acc_text}", (x1, max(0,y1-10)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

        ok, jpg = cv2.imencode(".jpg", annotated)
        if ok:
            with frame_lock:
                latest_frame_jpeg = jpg.tobytes()
                latest_women_count = women_count
                latest_male_present = male_present

        time.sleep(1.0 / MJPEG_FPS)

    cap.release()
    logging.info("Gender worker stopped")

@app.route("/video_feed")
def video_feed():
    def generator():
        while not stop_event.is_set():
            with frame_lock:
                frame = latest_frame_jpeg
            if frame:
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
            time.sleep(1.0 / MJPEG_FPS)
    return Response(stream_with_context(generator()), mimetype="multipart/x-mixed-replace; boundary=frame")

@app.route("/count_stream")
def count_stream():
    def event_stream():
        last = None
        while not stop_event.is_set():
            with frame_lock:
                wc = latest_women_count
                mp = latest_male_present
            payload = {"women_count": wc, "male_present": bool(mp)}
            if payload != last:
                yield f"data: {json.dumps(payload)}\n\n"
                last = payload
            time.sleep(0.5)
    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")

@app.route("/health")
def health():
    with frame_lock:
        return jsonify({"women_count": latest_women_count, "male_present": latest_male_present})

if __name__ == "__main__":
    detect_model, gender_model = load_models()
    t = threading.Thread(target=camera_worker, args=(detect_model, gender_model, FEED_SOURCE), daemon=True)
    t.start()
    try:
        # run on port 5002
        app.run(host="0.0.0.0", port=5002, threaded=True)
    finally:
        stop_event.set()
        t.join(timeout=2)
