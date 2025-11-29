# SmartRail AIoT: Intelligent Urban Transit System 🚆

**SmartRail AIoT** is a comprehensive solution designed to modernize the Mumbai Suburban Railway network. It addresses critical inefficiencies such as overcrowding, revenue leakage, and passenger safety using a fusion of Computer Vision, IoT (ESP32), and Agentic AI.

## 📄 Project Overview
The Mumbai Suburban Railway moves millions daily but suffers from:
- **Overcrowding:** "Super Dense Crush Load" leading to accidents.
- **Revenue Leakage:** Massive losses due to manual ticket checking limitations.
- **Reactive Safety:** Delayed responses to intrusions in women's compartments.
- **High Friction Ticketing:** Long queues discouraging digital adoption.

**SmartRail** solves this by providing real-time, AI-driven visibility to ensure passenger safety and operational profitability.

---

## 🚀 Key Features

### 1. The "Invisible Handshake" (Ticketless Travel Control)
A seamless, non-intrusive validation system.
- **Agentic Booking:** Users book tickets via Voice Command on the mobile app.
- **BLE Broadcasting:** The app broadcasts a unique encrypted Ticket ID (T-ID) via Bluetooth Low Energy (BLE 5.0).
- **Passive Scanning:** ESP32-S3 controllers at station entry points/train doors capture the T-ID without the user taking their phone out.
- **Real-time Validation:** Instant validation against the backend; invalid tokens trigger alerts.

### 2. AI Crowd & Gender Detection
- **Computer Vision:** YOLOv8 models process feeds from OV2640/CCTV cameras.
- **Real-time Insights:** Calculates crowd density percentages per coach.
- **Safety Alerts:** Detects men entering "Women-Only" compartments and triggers immediate alerts.

### 3. Dynamic Admin Dashboard
- **Live Monitoring:** View real-time crowd heatmaps and video feeds.
- **Metrics:** Track Revenue Leakage %, Safety Index, and Active SOS alerts.
- **Analytics:** Data visualization for station congestion and resource allocation.

---

## 🛠️ Tech Stack

### Hardware (IoT & Edge)
- **Controller:** ESP32-S3 (Dual-core, Wi-Fi + BLE 5.0).
- **Camera Module:** OV2640 / Standard Webcams.
- **Sensors:** NFC/BLE Readers.

### Software & AI
- **Mobile App:** React Native (Android/iOS).
- **AI Model:** YOLOv8 (Object Detection & Classification).
- **Backend:** Node.js / Python (Flask/FastAPI).
- **Database:** MongoDB (User data & Ticket logs), Firebase (Real-time syncing).
- **Cloud:** Google Cloud / AWS for model hostin.

---

## 🏗️ System Architecture

The system operates in three distinct phases:

1.  **Agentic Booking (User Side):**
    * User: *"Book ticket to Dadar."*
    * App: Generates T-ID -> Stores in MongoDB.
2.  **Wireless Layer:**
    * App: Broadcasts T-ID via BLE Advertising.
    * Station/Train: ESP32-S3 scans and filters T-ID signals.
3.  **Cloud Layer:**
    * Backend: Validates scanned T-ID.
    * Dashboard: Updates Passenger Count (if valid) or Ticketless Alert (if invalid).

---



## 🔧 Installation & Setup

### Prerequisites
- Node.js & npm
- Python 3.9+
- Arduino IDE / PlatformIO (for ESP32)
- MongoDB instance

### 1. Clone the Repository
```bash
git clone [https://github.com/Prathmesh-Navale/Smart_Rail.git](https://github.com/Prathmesh-Navale/Smart_Rail.git)
cd Smart_Rail



1. Backend Setup

After opening the project in VS-Code, navigate to the backend folder. You need to create a .env file for your database connection.

MONGO_URI=mongodb://localhost:27017/smartrail
PORT=5000


<h5>Make sure that your MongoDB is running locally or provide your Atlas connection string.</h5>



Now open the project terminal and type these commands inside the backend folder:

npm install
npm start


If you see "Server running on port 5000", you are good to go!

2. AI Engine (Computer Vision)

This module runs the YOLOv8 model. Open the ai_engine folder in your terminal.




It is recommended to create a virtual environment first.

python -m venv venv
# Activate the venv (Windows: venv\Scripts\activate, Mac/Linux: source venv/bin/activate)


Now install the required Python libraries:

pip install ultralytics opencv-python flask numpy


<h5>if you see an error regarding 'pip', make sure Python is added to your system PATH.</h5>



Run the detection script:

python main.py


This will start the camera feed and send data to the dashboard.



If any problem arises, just create an issue in this repository, I will try to figure that out.

End Product of this Project (Screenshots)

 
 
 
