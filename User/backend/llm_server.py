
from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_community.llms import Ollama
from pymongo import MongoClient
import datetime

app = Flask(__name__)
CORS(app)

# --- DATABASE CONNECTION ---
try:
    # Connects to default local MongoDB port
    client = MongoClient("mongodb://localhost:27017/")
    db = client["mumbai_genrail"]
    tickets_collection = db["tickets"]
    users_collection = db["users"] # Added users collection
    print("✅ Connected to MongoDB (Database: mumbai_genrail)")
    
    # Initialize a demo user if not exists (for testing)
    if users_collection.count_documents({"_id": "user_123"}) == 0:
        users_collection.insert_one({
            "_id": "user_123",
            "name": "Rahul",
            "wallet_balance": 200,
            "upi_id": "rahul@okaxis"
        })
        print("ℹ️ Demo user 'Rahul' created.")

except Exception as e:
    print(f"⚠️ Warning: MongoDB not connected. Data won't save. Error: {e}")
    tickets_collection = None
    users_collection = None

# --- LLM CONNECTION ---
try:
    llm = Ollama(model="llama3", temperature=0)
    print("✅ LLM Connected successfully.")
except Exception as e:
    print(f"⚠️ Warning: Could not connect to Ollama: {e}")
    llm = None

@app.route('/chat', methods=['POST'])
def chat():
    # 1. Parsing & Logging
    try:
        data = request.get_json(force=True)
        print(f"🔹 Debug Payload Received: {data}")
    except Exception as e:
        print(f"❌ Error parsing JSON: {e}")
        return jsonify({"response": "Error: Invalid JSON format"}), 400

    user_input = data.get('message', '')
    if not user_input:
        print("❌ Received empty message.")
        return jsonify({"response": "I didn't receive any text. Please try again."})

    text_lower = user_input.lower()
    
    response_text = ""
    booking_data = None
    
    print(f"💬 Processing: {user_input}")

    # --- 1. INTENT: BOOKING ---
    if "book" in text_lower or "ticket" in text_lower:
        if " to " in text_lower:
            try:
                parts = text_lower.split(" to ")
                dest_clean = parts[1].strip().split(" ")[0] 
                
                source_clean = "mumbai central" # Default
                if "from " in parts[0]:
                    source_clean = parts[0].split("from ")[1].strip().split(" ")[0]
                elif "from" in parts[0]:
                    source_clean = parts[0].split("from")[1].strip().split(" ")[0]
                
                source = source_clean.title()
                dest = dest_clean.title()
                
                # Logic: Generate Ticket Data
                ble_token = "BLE-SRV-" + source[:3].upper() + dest[:3].upper()
                fare = 15 # Simplified fare for demo
                
                response_text = f"✅ Ticket booked from {source} to {dest}. BLE Token: {ble_token}. Fare ₹{fare} deducted."
                
                booking_data = {
                    "source": source,
                    "destination": dest,
                    "fare": fare,
                    "ble_token": ble_token,
                    "timestamp": datetime.datetime.now().isoformat()
                }

                # SAVE TO MONGODB
                if tickets_collection is not None:
                    tickets_collection.insert_one(booking_data.copy())
                    
                    # Update Wallet
                    if users_collection is not None:
                         users_collection.update_one(
                            {"_id": "user_123"},
                            {"$inc": {"wallet_balance": -fare}}
                        )
                    print("✅ Booking saved & Wallet updated in MongoDB")
                
            except Exception as e:
                 print(f"Error processing booking: {e}")
                 response_text = "I see you want to book, but I couldn't catch the stations. Try format: 'Book from Dadar to Virar'."
        else:
            response_text = "Where would you like to go? Please specify the destination (e.g., 'to Andheri')."

    # --- 2. INTENT: WALLET ---
    elif "wallet" in text_lower or "balance" in text_lower:
        if users_collection is not None:
            user = users_collection.find_one({"_id": "user_123"})
            if user:
                bal = user.get('wallet_balance', 0)
                response_text = f"💰 Your current wallet balance is ₹{bal}."
            else:
                response_text = "User not found in database."
        else:
            response_text = "💰 Database disconnected. Simulated balance: ₹150."

    # --- 3. INTENT: GREETING / GENERAL (Fallback to LLM) ---
    else:
        if llm:
            try:
                response_text = llm.invoke(user_input)
            except Exception as e:
                response_text = f"LLM Error: {str(e)}"
        else:
            response_text = "System: LLM is offline, but I can help you book tickets! Try 'Book from X to Y'."

    # Return response to React
    # Use str() for ObjectId if returning raw mongo docs, but here we return clean booking_data
    if booking_data and "_id" in booking_data:
        del booking_data["_id"] # Remove Mongo ID before sending to frontend

    return jsonify({
        "response": response_text,
        "booking": booking_data
    })
@app.route('/book', methods=['POST'])
def book_ticket_manual():
    try:
        data = request.get_json(force=True)
        if tickets_collection is not None:
            tickets_collection.insert_one(data.copy())
            
            # Optional: Deduct from DB wallet if you want strict sync
            if users_collection is not None:
                users_collection.update_one(
                    {"_id": "user_123"},
                    {"$inc": {"wallet_balance": -data.get('fare', 0)}}
                )
            print(f"✅ Manual Booking Saved: {data.get('id')}")
            return jsonify({"status": "success", "message": "Ticket saved"}), 200
        else:
            return jsonify({"status": "error", "message": "DB not connected"}), 500
    except Exception as e:
        print(f"❌ Error saving manual ticket: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
if __name__ == '__main__':
    print("Server starting on port 5000...")
    app.run(port=5000)