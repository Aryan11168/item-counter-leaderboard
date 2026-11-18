# Item Tracker & Live Leaderboard 🏆

A modern web application to track item counts per person with an official Top 3 podium leaderboard and role-based permissions:
- **Admin**: Can add new participants (starting at count 0), increment/decrement counts, and remove people.
- **Viewers (Public)**: Can view the live item counts, search, and view the leaderboard in real time without being able to edit anything.

---

## 🚀 How to Push to GitHub

1. Open your terminal in this project folder:
   ```bash
   cd /Users/aryan/.gemini/antigravity/scratch/item-counter-leaderboard
   ```

2. Initialize Git and make the initial commit:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Item Tracker & Leaderboard with Admin controls"
   ```

3. Create a new repository on [GitHub](https://github.com/new) (e.g. name it `item-counter-leaderboard`).

4. Link and push to GitHub (replace `<YOUR_USERNAME>` with your GitHub username):
   ```bash
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/item-counter-leaderboard.git
   git push -u origin main
   ```

---

## ⚡ How to Deploy on Vercel

1. Go to [Vercel](https://vercel.com/) and click **"Add New..."** → **"Project"**.
2. Select your `item-counter-leaderboard` repository from GitHub and click **Deploy**.
3. **Connect Vercel KV Storage (For multi-user cloud persistence)**:
   - In your project on Vercel, go to the **Storage** tab.
   - Click **Create Database** → select **KV**.
   - Name it (e.g., `item-tracker-kv`) and click **Create**.
   - Click **Connect Project** to connect it to this project. Vercel will automatically configure `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you!
4. **Set Your Custom Admin Password (Optional)**:
   - In your project on Vercel, go to **Settings** → **Environment Variables**.
   - Add a new variable:
     - **Key**: `ADMIN_PASSWORD`
     - **Value**: `your_secret_password` (default if omitted is `admin123`).
   - Click **Save** and redeploy.

---

## 🔑 Admin Access
- Click **"Admin Login"** in the top navigation.
- Enter your admin password (default: `admin123`).
- Editing buttons (`+`, `-`, Add Person, Delete) will appear immediately.
- Regular visitors browsing the site will see a clean read-only scoreboard with live updates!
