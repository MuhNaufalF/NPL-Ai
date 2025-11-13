# === SALIN SEMUA DARI BAWAH INI KE app.py ===

import os
import base64
import io
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS

# ----------------------------------------------------
# PENTING: Set API Key Anda di sini
# ----------------------------------------------------
try:
    GEMINI_API_KEY = os.environ['GEMINI_API_KEY']
except KeyError:
    print("PERINGATAN: Tidak menemukan GEMINI_API_KEY di environment.")
    print("Menggunakan API Key yang di-hardcode (hanya untuk tes).")
    # GANTI INI DENGAN API KEY BARU ANDA NANTI
    GEMINI_API_KEY = "AIzaSyANokha6BajN5SIJIPkirmQuKXSeND-iRw" 

genai.configure(api_key=GEMINI_API_KEY)

# (Ini kode yang sudah diperbarui)
perintah_sistem = "Kamu adalah asisten AI yang ramah. Selalu balas dalam Bahasa Indonesia, apa pun bahasa yang digunakan pengguna."

# Tentukan setelan keamanan untuk melonggarkan filter
safety_settings = {
    'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'BLOCK_NONE',
    'HARM_CATEGORY_HATE_SPEECH': 'BLOCK_NONE',
    'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE',
    'HARM_CATEGORY_DANGEROUS_CONTENT': 'BLOCK_NONE',
}

model = genai.GenerativeModel(
    'gemini-2.5-pro',
    system_instruction=perintah_sistem,
    safety_settings=safety_settings  # <-- TAMBAHKAN BARIS INI
)
chat = model.start_chat(history=[])

# Inisialisasi Aplikasi Flask
app = Flask(__name__)
CORS(app) 

@app.route('/api/chat', methods=['POST'])
def handle_chat():
    try:
        user_prompt = request.json['prompt']

        # Kirim pesan ke AI
        response = chat.send_message(user_prompt)

        # --- INI BAGIAN BARU YANG PENTING ---
        # Coba dapatkan teks dari respons
        try:
            reply_text = response.text
        except ValueError:
            # INI TERJADI JIKA AI MEMBLOKIR RESPONS (KARENA SAFETY)
            print("Peringatan: Respons diblokir oleh safety filter Google.")
            reply_text = "Maaf, saya tidak dapat merespons permintaan Anda karena topik tersebut sensitif atau dibatasi."
        except Exception as e:
            # Menangkap error lain yang mungkin terjadi
            print(f"Error saat mengakses .text: {e}")
            reply_text = "Terjadi error saat memproses balasan AI."
        # --- AKHIR BAGIAN BARU ---

        return jsonify({'reply': reply_text})

    except Exception as e:
        # Ini menangkap error besar di luar logika chat
        print(f"Error di handle_chat: {e}") 
        return jsonify({'error': 'Terjadi kesalahan server internal.'}), 500

# === ENDPOINT BARU UNTUK GENERATE GAMBAR (CARA DARI AI STUDIO) ===

@app.route('/api/generate-image', methods=['POST'])
def handle_image_generation():
    try:
        user_prompt = request.json['prompt']

        # Kita gunakan API Key yang sama dengan chat teks
        # (API Key ini sudah di-set di 'genai.configure')

        print(f"Mengirim prompt gambar ke Google AI (GenAI): {user_prompt}")

        # Panggil model dari screenshot Anda
        # Kita perlu 'genai.GenerativeModel'
        model = genai.GenerativeModel("models/imagen-3.0-generate-001")

        # Generate gambar - gunakan cara yang benar
        response = model.generate_content(
            user_prompt,
            generation_config=genai.types.GenerationConfig(
                output_mime_type="image/jpeg"
            ),
            safety_settings=safety_settings
        )

        # Ambil data bytes dari gambar
        image_bytes = response.parts[0].data

        # Encode ke Base64 untuk dikirim ke frontend
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')

        print("Berhasil generate gambar (GenAI), mengirim ke frontend.")
        return jsonify({'image_url': f'data:image/jpeg;base64,{image_base64}'})

    except Exception as e:
        # INI PENTING
        print(f"Error di handle_image_generation: {e}") 
        # Jika error 404, itu akan muncul di sini
        return jsonify({'error': f'Gagal membuat gambar. Error: {e}'}), 500

# === AKHIR ENDPOINT BARU ===

# === ENDPOINT BARU UNTUK GENERATE VIDEO (CARA DARI AI STUDIO) ===

@app.route('/api/generate-video', methods=['POST'])
def handle_video_generation():
    try:
        user_prompt = request.json['prompt']

        print(f"Mengirim prompt video ke Google AI (GenAI): {user_prompt}")

        # Panggil model VEO dari screenshot Anda
        model = genai.GenerativeModel("models/veo-2.0-generate-001")

        # Generate video
        response = model.generate_content(
            user_prompt,
            generation_config=genai.types.GenerationConfig(
                output_mime_type="video/mp4"
            ),
            safety_settings=safety_settings
        )

        # Ambil data video
        video_bytes = response.parts[0].data

        # Encode ke Base64 untuk dikirim ke frontend
        video_base64 = base64.b64encode(video_bytes).decode('utf-8')

        print("Berhasil generate video (GenAI), mengirim ke frontend.")
        # Kirim data video sebagai data URL
        return jsonify({
            'video_url': f'data:video/mp4;base64,{video_base64}'
        })

    except Exception as e:
        # INI HAMPIR PASTI AKAN TERJADI (ERROR 404)
        print(f"Error di handle_video_generation: {e}") 
        return jsonify({'error': f'Gagal membuat video. Error: {e}'}), 500

# === AKHIR ENDPOINT BARU ===


if __name__ == '__main__':
    app.run(port=5000, debug=True)
# === AKHIR DARI FILE app.py ===