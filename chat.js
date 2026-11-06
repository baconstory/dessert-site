import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getDatabase, ref, push, set, serverTimestamp, query, orderByChild, limitToLast, onValue } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';

const statusEl = document.querySelector('#chatStatus');
const helpEl = document.querySelector('#chatHelp');
const logEl = document.querySelector('#chatLog');
const form = document.querySelector('#chatForm');
const nameEl = document.querySelector('#chatName');
const textEl = document.querySelector('#chatText');
const sendEl = document.querySelector('#chatSend');

nameEl.value = localStorage.getItem('dessert-chat-name') || '';
const missingConfig = Object.values(firebaseConfig).some(value => !value || value.startsWith('YOUR_') || value.includes('YOUR_PROJECT_ID'));

if (missingConfig) {
  helpEl.textContent = '실시간 채팅을 켜려면 firebase-config.js에 Firebase 프로젝트 설정을 넣고 Realtime Database와 익명 로그인을 켜 주세요.';
} else {
  startChat().catch(error => {
    statusEl.textContent = '연결 실패';
    helpEl.textContent = 'Firebase 설정을 확인해 주세요. Realtime Database, 익명 로그인, 보안 규칙 설정이 필요합니다.';
    console.error('Firebase chat connection failed:', error);
  });
}

async function startChat() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const database = getDatabase(app);
  await signInAnonymously(auth);

  statusEl.textContent = '실시간 연결됨';
  statusEl.classList.add('online');
  helpEl.textContent = '메시지는 최근 60개까지 표시됩니다. 닉네임과 메시지는 공개 채팅에 보입니다.';
  sendEl.disabled = false;

  const messagesQuery = query(ref(database, 'publicChat'), orderByChild('createdAt'), limitToLast(60));
  onValue(messagesQuery, snapshot => {
    logEl.replaceChildren();
    if (!snapshot.exists()) {
      const empty = document.createElement('p');
      empty.className = 'chat-empty';
      empty.textContent = '첫 번째 인사를 남겨 보세요.';
      logEl.append(empty);
      return;
    }
    snapshot.forEach(child => {
      const message = child.val();
      const row = document.createElement('article');
      row.className = `chat-message${message.uid === auth.currentUser?.uid ? ' mine' : ''}`;
      const meta = document.createElement('p');
      meta.className = 'chat-meta';
      const date = Number.isFinite(message.createdAt) ? new Date(message.createdAt) : new Date();
      meta.textContent = `${message.name} · ${date.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'})}`;
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      bubble.textContent = message.text;
      row.append(meta, bubble);
      logEl.append(row);
    });
    logEl.scrollTop = logEl.scrollHeight;
  }, error => {
    statusEl.textContent = '접근 권한 확인 필요';
    helpEl.textContent = 'Firebase Realtime Database 보안 규칙이 채팅 읽기를 허용하는지 확인해 주세요.';
    console.error('Firebase chat listener failed:', error);
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = nameEl.value.trim().slice(0, 24);
    const text = textEl.value.trim().slice(0, 300);
    if (!name || !text) {
      helpEl.textContent = '닉네임과 메시지를 입력해 주세요.';
      return;
    }
    sendEl.disabled = true;
    try {
      localStorage.setItem('dessert-chat-name', name);
      await set(push(ref(database, 'publicChat')), {
        uid: auth.currentUser.uid,
        name,
        text,
        createdAt: serverTimestamp()
      });
      textEl.value = '';
      textEl.focus();
      helpEl.textContent = '메시지를 보냈어요.';
    } catch (error) {
      helpEl.textContent = '메시지를 보내지 못했어요. Firebase 보안 규칙을 확인해 주세요.';
      console.error('Firebase chat send failed:', error);
    } finally {
      sendEl.disabled = false;
    }
  });
}
