import asyncio
import json
import aiohttp
import os
import re
from flask import Flask, render_template, request, jsonify
import psycopg2
from dotenv import load_dotenv
import logging
from flask_socketio import SocketIO, emit
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
load_dotenv()
socketio = SocketIO(app, cors_allowed_origins="*")

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")

# Setup logging
logging.basicConfig(level=logging.INFO)


# Database connection function
def get_db_connection():
    conn = psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        host=os.getenv("POSTGRES_HOST"),
        port=os.getenv("POSTGRES_PORT"),
    )
    return conn


async def fetch_username(session, user_id):
    url = f"https://discord.com/api/v9/users/{user_id}"
    headers = {"Authorization": f"Bot {DISCORD_TOKEN}"}
    async with session.get(url, headers=headers) as response:
        if response.status == 200:
            user_data = await response.json()
            return user_data["username"]
        return None


async def fetch_usernames(user_ids):
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_username(session, user_id) for user_id in user_ids]
        usernames = await asyncio.gather(*tasks)
        return {
            user_id: username
            for user_id, username in zip(user_ids, usernames)
            if username
        }


def extract_user_ids(message):
    pattern = r"<@!?(\d+)>"
    return re.findall(pattern, message)


@app.route("/api/logs")
def get_logs():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, encoded_message FROM message_logs ORDER BY id DESC")
    rows = cur.fetchall()
    logs = [{"id": row[0], **json.loads(row[1])} for row in rows]
    cur.close()
    conn.close()

    user_ids = set()
    for log in logs:
        if "message" in log:
            extracted_user_ids = extract_user_ids(log["message"])
            user_ids.update(extracted_user_ids)

    usernames = asyncio.run(fetch_usernames(user_ids))

    for log in logs:
        if "message" in log:
            for user_id, username in usernames.items():
                log["message"] = re.sub(
                    f"<@!?{user_id}>", f"@{username}", log["message"]
                )

    return jsonify(logs)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/new_entry", methods=["POST"])
def new_entry():
    data = request.json
    message_data = data.get("message_data")
    log_message_to_db(message_data)
    socketio.emit("new_log", {"log": message_data})
    return jsonify({"status": "success", "message": "New entry added"}), 200


@app.route("/api/delete_all_logs", methods=["DELETE"])
def delete_all_logs():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM message_logs")
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"status": "success", "message": "All logs deleted"}), 200


@app.route("/api/delete_selected_logs", methods=["DELETE"])
def delete_selected_logs():
    data = request.json
    ids = data.get("ids")
    conn = get_db_connection()
    cur = conn.cursor()
    cur.executemany("DELETE FROM message_logs WHERE id = %s", [(id_,) for id_ in ids])
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"status": "success", "message": "Selected logs deleted"}), 200


def log_message_to_db(message_data):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO message_logs (encoded_message) VALUES (%s)",
        (json.dumps(message_data),),
    )
    conn.commit()
    cur.close()
    conn.close()


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)
