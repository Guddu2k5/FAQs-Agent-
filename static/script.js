const messagesEl = document.getElementById("chat-messages");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const chips = document.querySelectorAll(".chip");
const chatBubble = document.getElementById("chat-bubble");
const chatWidget = document.getElementById("chat-widget");
const chatClose = document.getElementById("chat-close");
const heroCta = document.getElementById("hero-cta");
const askButtons = document.querySelectorAll(".ask-btn");
const newChatBtn = document.getElementById("new-chat-btn");
const endChatBtn = document.getElementById("end-chat-btn");
const humanBtn = document.getElementById("human-btn");
const suggestedEl = document.getElementById("suggested-questions");

function ifExists(el, fn) {
  if (el) fn(el);
}

let chatEnded = false;

/* ---------- Chat widget open/close ---------- */
function openChat() {
  chatWidget.classList.add("open");
  inputEl.focus();
}
function closeChat() {
  chatWidget.classList.remove("open");
}
ifExists(chatBubble, (el) => el.addEventListener("click", () => {
  chatWidget.classList.contains("open") ? closeChat() : openChat();
}));
ifExists(chatClose, (el) => el.addEventListener("click", closeChat));
ifExists(heroCta, (el) => el.addEventListener("click", openChat));

askButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    openChat();
    inputEl.value = btn.dataset.question;
    handleSend();
  });
});



function addMessage(text, sender) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;

  if (sender === "bot") {
    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.textContent = "🎓";
    msgDiv.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (sender === "bot") {
    bubble.innerHTML = marked.parse(text);
  } else {
    bubble.textContent = text;
  }

  msgDiv.appendChild(bubble);
  messagesEl.appendChild(msgDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeLoading(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function showLoading() {
  const msgDiv = document.createElement("div");
  msgDiv.className = "message bot";
  msgDiv.id = "loading-msg";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "🎓";
  msgDiv.appendChild(avatar);

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>`;
  msgDiv.appendChild(bubble);

  messagesEl.appendChild(msgDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return "loading-msg";
}



/* ---------- Send message ---------- */
async function handleSend() {
  if (chatEnded) return;
  const text = inputEl.value.trim();
  if (!text) return;

  suggestedEl.style.display = "none";
  inputEl.disabled = true;
  sendBtn.disabled = true;

  addMessage(text, "user");
  inputEl.value = "";

  const loadingId = showLoading();

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    removeLoading(loadingId);
    addMessage(data.reply, "bot");
  } catch (err) {
    removeLoading(loadingId);
    addMessage("Network error. Please try again.", "bot");
  } finally {
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

sendBtn.addEventListener("click", handleSend);
inputEl.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSend();
});
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    inputEl.value = chip.textContent;
    handleSend();
  });
});

/* ---------- New Chat ---------- */
newChatBtn.addEventListener("click", async () => {
  try {
    await fetch("/new-chat", { method: "POST" });
  } catch (err) {
    console.error("Could not reset server session:", err);
  }
  messagesEl.innerHTML = "";
  addMessage("👋 Starting fresh! Ask me anything about REVA University.", "bot");
  suggestedEl.style.display = "flex";
  chatEnded = false;
  inputEl.disabled = false;
  sendBtn.disabled = false;
  inputEl.focus();
});

/* ---------- End Chat ---------- */
endChatBtn.addEventListener("click", () => {
  const sysDiv = document.createElement("div");
  sysDiv.className = "message system";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = "Chat session ended. Click 🔄 New Chat to start again.";
  sysDiv.appendChild(bubble);
  messagesEl.appendChild(sysDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  chatEnded = true;
  inputEl.disabled = true;
  sendBtn.disabled = true;
});

/* ---------- Talk to a human ---------- */
humanBtn.addEventListener("click", () => {
  const sysDiv = document.createElement("div");
  sysDiv.className = "message bot";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `Sure — for anything I can't fully help with, you can reach REVA's admissions team directly:<br><br>
    📞 <strong>+91-90211 90211</strong><br>
    ✉️ <strong>admissions@reva.edu.in</strong><br>
    🕐 7 days a week, 8:30 AM – 5:30 PM`;
  sysDiv.appendChild(bubble);
  messagesEl.appendChild(sysDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;
});



/* ---------- Logo: show real logo.jpg if it loads, else keep SVG fallback ---------- */
const siteLogo = document.getElementById("site-logo");
const logoFallback = document.getElementById("logo-fallback");

function showLoadedLogo() {
  siteLogo.style.display = "block";
  logoFallback.style.display = "none";
}
function showFallbackLogo() {
  siteLogo.style.display = "none";
  logoFallback.style.display = "block";
}

if (siteLogo.complete && siteLogo.naturalWidth > 0) {
  // Image was already loaded from cache before this script ran
  showLoadedLogo();
} else if (siteLogo.complete && siteLogo.naturalWidth === 0) {
  // Browser already tried and failed (broken/missing image), also from cache
  showFallbackLogo();
} else {
  // Not loaded yet — wait for the actual load/error events
  siteLogo.addEventListener("load", showLoadedLogo);
  siteLogo.addEventListener("error", showFallbackLogo);
}


/* ---------- Any image slot: load real photo if present, else keep emoji placeholder ---------- */
document.querySelectorAll(".img-placeholder").forEach((el) => {
  const path = el.dataset.img;
  if (!path) return;
  const testImg = new Image();
  testImg.onload = () => {
    el.style.backgroundImage = `url('${path}')`;
    el.textContent = "";
  };
  testImg.onerror = () => {
    // keep emoji placeholder — real photo not added yet
  };
  testImg.src = path;
});

/* ---------- Lightbox (zoom) ---------- */
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");
const lightboxClose = document.getElementById("lightbox-close");

document.querySelectorAll(".gallery-item").forEach((el) => {
  el.addEventListener("click", () => {
    const bgImage = el.style.backgroundImage;
    if (!bgImage) return;
    const urlMatch = bgImage.match(/url\(["']?(.*?)["']?\)/);
    if (!urlMatch) return;
    lightboxImg.src = urlMatch[1];
    lightboxCaption.textContent = el.dataset.caption || "";
    lightbox.classList.add("open");
  });
});

function closeLightbox() {
  lightbox.classList.remove("open");
}
lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});


/* ---------- Rankings badges: staggered scroll-in animation ---------- */
const badges = document.querySelectorAll(".badge");
if (badges.length > 0) {
  const badgeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const index = Array.from(badges).indexOf(entry.target);
        setTimeout(() => {
          entry.target.classList.add("badge-visible");
        }, index * 100); // stagger each badge by 100ms
        badgeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  badges.forEach((badge) => badgeObserver.observe(badge));
}