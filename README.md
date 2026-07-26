<div align="center">

# 🐇 Git-Rabbit

### _Solve. Accept. Forget about it._

**The fastest way to automatically archive your competitive programming solutions to GitHub.**<br/>
One click. Three files. Single atomic commit. Zero manual copy-pasting.

<br/>

![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![JavaScript](https://img.shields.io/badge/Vanilla_JS-Zero_Dependencies-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)

<br/>

![LeetCode](https://img.shields.io/badge/LeetCode-GraphQL_API-FFA116?style=flat-square&logo=leetcode&logoColor=white)
![Codeforces](https://img.shields.io/badge/Codeforces-Public_API-1F8ACB?style=flat-square&logo=codeforces&logoColor=white)
![AtCoder](https://img.shields.io/badge/AtCoder-Kenkoooo_API-222222?style=flat-square)

</div>

---

## ⚡ Overview

**Git-Rabbit** is a modern Manifest V3 browser extension built to automate the archiving of competitive programming solutions.

Whenever you get an **Accepted (AC)** verdict on LeetCode, Codeforces, or AtCoder, Git-Rabbit intercepts the submission, extracts your code, performance stats, and problem description, and displays an on-page terminal widget. You can log your notes, time complexity `O(N)`, and space complexity `O(1)`, then push everything to your GitHub repository in a **single atomic Git commit**.

---

## 🔄 How It Works

```text
┌────────────────────────────────────────────────────────────────┐
│                    BROWSER CONTENT SCRIPT                      │
│                                                                │
│  [LeetCode / Codeforces / AtCoder] ──► Auto-detect AC Verdict  │
│                                               │                │
│                                               ▼                │
│  Inject Shadow DOM Widget ◄────────── Fetch Code & Metadata    │
│  (Input Notes, Time & Space Complexity)       │                │
│                       │                       │                │
└───────────────────────┼───────────────────────┼────────────────┘
                        │                       │
                        ▼                       ▼
            ┌───────────────────────────────────────┐
            │   SERVICE WORKER (Background V3)      │
            │   - Formats Question.md & Notes.md    │
            │   - Calls GitHub Git Data API         │
            └───────────────────┬───────────────────┘
                                │
                                ▼
            ┌───────────────────────────────────────┐
            │      GITHUB REPOSITORY (Target)       │
            │   LeetCode/0001-Two-Sum/              │
            │     ├── Question.md                   │
            │     ├── Solution.cpp                  │
            │     └── Notes.md                      │
            └───────────────────────────────────────┘
```

---

## ✨ Features

- ⚛️ **Atomic Multi-File Commits**: Uses GitHub's low-level Git Data API (`blobs` ➔ `trees` ➔ `commits`) to push `Question.md`, `Solution.ext`, and `Notes.md` in one clean commit without polluting your repository history.
- ⏱️ **Complexity Logger**: Embedded single-line inputs in the widget to log Time `O(N)` and Space `O(1)` complexities directly into `Notes.md`.
- 🎨 **Monochrome Terminal UI**: JetBrains Mono font, absolute black styling, and cyan accents. Rendered inside a **Shadow DOM** to prevent CSS leakage to/from the host website.
- 📊 **Live README Statistics**: Automatically updates your target repository's `README.md` with solve counts grouped by platform, difficulty, and language.
- ♻️ **Duplicate Protection**: Automatically checks if a solution exists on GitHub before pushing and prompts an explicit "UPDATE" overwrite state.

---

## 🌐 Supported Platforms

| Platform | Domain | Method | Problem ID Format | Example |
|:---------|:-------|:-------|:------------------|:--------|
| **LeetCode** | `leetcode.com` | GraphQL API | Zero-padded 4-digit | `0001`, `0075` |
| **Codeforces** | `codeforces.com` | Public REST API | Contest + Index | `1500A`, `1800B` |
| **AtCoder** | `atcoder.jp` | Kenkoooo API + Scraper | Contest + Task | `abc200_a` |

---

## ⚙️ Installation & Setup

### Step 1: Generate GitHub Classic Token
Git-Rabbit requires a **Classic Personal Access Token** because fine-grained tokens currently lack support for low-level Git Data API operations.

1. Go to [GitHub Token Settings](https://github.com/settings/tokens/new?scopes=repo&description=Git-Rabbit).
2. Create a **Classic Token** with the **`repo`** scope.
3. Copy the generated token string.

### Step 2: Install Extension (Load Unpacked)

Because of modern browser security restrictions, the most reliable way to install open-source extensions is via the "Load Unpacked" method. You have two options to get the code:

**Option A: Download ZIP (Recommended for most users)**
1. Go to the **[Releases Page](https://github.com/prabhu-omkar/Git-Rabbit/releases/latest)** and download the **`Source code (zip)`** file.
2. Extract (unzip) the downloaded folder on your computer.

**Option B: Clone from Source (For developers)**
1. Open your terminal and run:
   ```bash
   git clone https://github.com/prabhu-omkar/Git-Rabbit.git
   ```

**Next, load it into your browser:**
1. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/`).
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `Git-Rabbit` folder you just downloaded/cloned.

### Step 3: Configure Settings
1. Click the Git-Rabbit icon in your toolbar (or right-click ➔ Options).
2. Enter your **AUTH_TOKEN** and **TARGET_REPO** (e.g. `your-username/my-solutions`).
3. Click **TEST** to verify connection, then **COMMIT** to initialize the repository.

---

## 🗂️ Output Structure

Every solution is organized into a dedicated folder with three files:

```text
📦 target-repository/
├── 📁 LeetCode/
│   └── 📁 0001-Two-Sum/
│       ├── 📄 Question.md       # Full problem statement & constraints
│       ├── 📄 Solution.cpp      # Your accepted source code
│       └── 📄 Notes.md          # Submission stats & complexity annotations
├── 📁 Codeforces/
│   └── 📁 1500A-Watermelon/
│       └── ...
└── 📄 README.md                 # Auto-generated live stats dashboard
```

### Sample `Notes.md`

```markdown
# 📝 Notes — LeetCode 0001: Two Sum

## 📊 Submission Stats

| Metric | Value |
|:-------|:------|
| **Difficulty** | Easy |
| **Topics** | Array, Hash Table |
| **Time Complexity** | `O(N)` |
| **Space Complexity** | `O(N)` |
| **Runtime** | 4 ms |
| **Memory** | 10.8 MB |
| **Language** | cpp |

## 💡 Approach
Used a hash map to store complement values in a single pass.

## ⏱️ Complexity Analysis
- **Time:** `O(N)`
- **Space:** `O(N)`

---
> Synced on 2025-07-31 via **Git-Rabbit**
```

---

## 🔬 Architecture & Technical Details

### Single Commit via Git Data API
Instead of making sequential REST calls that create multiple commits per problem, Git-Rabbit constructs the Git tree directly:
1. **POST `/git/blobs`**: Uploads `Question.md`, `Solution.cpp`, and `Notes.md` as raw blobs.
2. **POST `/git/trees`**: Constructs a single tree referencing all three blobs.
3. **POST `/git/commits`**: Creates a single commit pointing to the new tree.
4. **PATCH `/git/refs`**: Updates the target branch pointer atomically.

### Adapter Pattern
Scraping logic is decoupled from UI and background storage. Each platform implements a stateless adapter extending `BasePlatformAdapter` to handle platform-specific GraphQL queries or API endpoints.

---

## 📜 License

[MIT License](LICENSE)
         