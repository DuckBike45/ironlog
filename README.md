# 🏋️‍♂️ IronLog — Personal Weightlifting Tracker

A lightning-fast, mobile-first web application designed specifically for gym workouts. Log sets in seconds, create workout templates, check individual move history right inside your workout, and keep track of your progressive overload with zero friction.

---

## 🚀 Running Locally (On Your Computer)

In your terminal:
```bash
npm start
```
*(Or run `npm run dev` for hot-reloading during development)*

Open your browser:
👉 **`http://localhost:3001`**

To open on your phone over home/gym Wi-Fi:
Find your computer's IP with `ipconfig` and open `http://<YOUR-IP>:3001`.

---

## ☁️ Free Online Deployment: Vercel + Turso (Step-by-Step)

This setup is **100% free forever**, **never loses data**, and **wakes up instantly in <1 second** when you open it at the gym.

### Step 1: Create Your Free Cloud Database (Turso)
1. Go to **[turso.tech](https://turso.tech)** and sign up for a free account (using GitHub or Google).
2. In the Turso dashboard, click **Create Database**.
3. Name it `ironlog` and select the region closest to you.
4. Once created, click on your database:
   - Copy your **Database URL** (starts with `libsql://ironlog-...turso.io`).
   - Click **Create Token** (or Settings -> Tokens) and copy the **Auth Token**.
5. *Note: You don't need to create any tables manually! When your app connects for the first time, IronLog automatically creates all tables and seeds the 29 starter exercises!*

---

### Step 2: Push Your Project to GitHub
1. Create a free account at **[github.com](https://github.com)** if you don't already have one.
2. Click **New Repository**, name it `ironlog`, and choose **Private** (or Public).
3. In PowerShell inside your project folder (`c:\Antigravity Projects Tommi`):
   ```powershell
   git init
   git add .
   git commit -m "Initial IronLog commit"
   git branch -M main
   git remote add origin https://github.com/<YOUR-USERNAME>/ironlog.git
   git push -u origin main
   ```

---

### Step 3: Deploy for Free on Vercel
1. Go to **[vercel.com](https://vercel.com)** and sign in with your GitHub account.
2. Click **Add New...** -> **Project**.
3. Select your `ironlog` repository and click **Import**.
4. In the configuration screen, expand **Environment Variables** and add two values:
   - **`TURSO_DATABASE_URL`**: paste your Turso URL (`libsql://ironlog-...`)
   - **`TURSO_AUTH_TOKEN`**: paste your Turso token
5. Click **Deploy**!

Within ~60 seconds, Vercel will give you your permanent link:
👉 **`https://ironlog-xxxx.vercel.app`**

Open that link on your phone, tap **"Add to Home Screen"**, and you have a native-feeling gym app with zero monthly cost and permanent cloud data safety!

---

## ✨ Features Built For The Gym

- **📋 Workout Templates & Manager:**
  - Create standard routines (e.g., *Push Day*, *Pull Day*, *Legs*) with exercises in order.
  - Launch workouts in 1 tap from the home screen with all exercises pre-loaded.
  - Full gym flexibility: swap, add, or delete exercises during the workout without modifying your master template.
- **⭐ Frequently Used Lifts at the Top:**
  - Automatically surfaces your most performed lifts at the top of the exercise picker for fast selection.
- **📈 In-Workout Move History:**
  - Each exercise card features a **"History"** button that opens a slide-up sheet over the workout without leaving the screen.
  - See full chronological progression: date, workout title, and all sets with weights and reps (`80kg × 8, 82.5kg × 6...`).
- **⚡ Fast Set Logging:**
  - Automatically pre-fills weight & reps from your previous set.
  - Dedicated kilogram stepper buttons (`-2.5`, `+1.25`, `+2.5`, `+5`) matching standard gym plates.
  - Quick rep adjusters (`-1`, `+1`).
  - Warmup set tag (`W`) toggle.
- **📊 Previous Performance Context:**
  - Selecting any exercise instantly reveals what you lifted in your most recent completed session (e.g., *Last Session: 80kg × 8, 80kg × 8, 75kg × 8*).
- **⏱️ 2:00 Manual Rest Timer:**
  - One-tap start for 2:00 rest between heavy sets.
  - Silent visual pulse banner alert upon completion (no unwanted audio in gym headphones).
- **📝 Real-time Session Persistence:**
  - Every set and exercise is saved in real time. If your phone screen sleeps or the page refreshes, nothing is lost.
- **📚 Curated Exercise Library:**
  - Pre-seeded with 29 staple compound and isolation movements across Chest, Back, Legs, Shoulders, Arms, and Core.
  - Create custom exercises at any time with 1 tap.
- **📜 Workout History:**
  - Review past sessions, total lifted volume (kg), set counts, and workout notes.

---

## 🛠️ Tech Stack & Architecture

- **Backend:** Node.js + Express (Local server & Vercel Serverless Function `/api`)
- **Database:** SQLite / libSQL via `@libsql/client`:
  - Automatically runs locally against `server/workouts.db` when offline.
  - Automatically connects to **Turso** when `TURSO_DATABASE_URL` is set in production.
- **Frontend:** React + Vite + Tailwind CSS + Lucide Icons
- **Deployment:** Vercel (Edge CDN + Serverless APIs)
