import React, { useState, useEffect, useRef } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import {
  Volume2,
  Settings,
  Plus,
  Star,
  Trash2,
  Edit2,
  LogOut,
  LogIn,
} from "lucide-react";

// ---------------------------------------------------------
// [필수] Firebase 설정 (나중에 본인의 Firebase 정보로 교체해야 합니다)
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBcsDK56hrVVM8_nN0ORDDJ6ZL-fddTHxQ",
  authDomain: "english-study-f6bad.firebaseapp.com",
  projectId: "english-study-f6bad",
  storageBucket: "english-study-f6bad.firebasestorage.app",
  messagingSenderId: "819086400364",
  appId: "1:819086400364:web:66f18d14a6d9ccbf653149",
  measurementId: "G-0HS0S1VVY4",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------------------------------------------------
// 메인 앱 컴포넌트
// ---------------------------------------------------------
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [words, setWords] = useState([]);
  const [activeTab, setActiveTab] = useState("learn"); // 'learn', 'star', 'add', 'manage'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [ttsRate, setTtsRate] = useState(1.0);

  const [newEn, setNewEn] = useState("");
  const [newKo, setNewKo] = useState("");
  const [newPron, setNewPron] = useState("");
  const [bulkText, setBulkText] = useState("");

  // 로그인 상태 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // 로그인하면 Firestore에서 내 단어장 불러오기
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setWords(docSnap.data().words || []);
        } else {
          setWords([]); // 새 계정은 빈 단어장으로 시작
        }
      } else {
        setWords([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // 단어장이 바뀔 때마다 Firestore에 자동 저장
  useEffect(() => {
    if (user && words.length > 0) {
      setDoc(doc(db, "users", user.uid), { words });
    }
  }, [words, user]);

  // 구글 로그인/로그아웃 함수
  const handleLogin = () => signInWithPopup(auth, new GoogleAuthProvider());
  const handleLogout = () => signOut(auth);

  // TTS 음성 재생
  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = ttsRate;
    window.speechSynthesis.speak(utterance);
  };

  // 단어 넘기기
  const nextWord = (list) => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % list.length);
  };
  const prevWord = (list) => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + list.length) % list.length);
  };

  // 별표(모르는 단어) 토글
  const toggleStar = (id) => {
    setWords(
      words.map((w) => (w.id === id ? { ...w, isStarred: !w.isStarred } : w))
    );
  };

  // 단일 추가
  const addSingleWord = () => {
    if (!newEn.trim() || !newKo.trim()) return;
    const newWord = {
      id: Date.now(),
      en: newEn.trim(),
      ko: newKo.trim(),
      pron: newPron.trim(),
      isStarred: false,
    };
    setWords([...words, newWord]);
    setNewEn("");
    setNewKo("");
    setNewPron("");
    alert("단어가 추가되었습니다.");
  };

  // 대량 추가 (숫자 제거 및 [] 발음 기호 파싱)
  const addBulkWords = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split("\n");
    const newWords = lines
      .map((line) => {
        // 1. 앞에 붙은 번호와 마침표 제거 (예: "1. clumsy" -> "clumsy")
        let cleanLine = line.replace(/^\d+\.\s*/, "").trim();
        if (!cleanLine) return null;

        // 2. [] 발음 기호 추출
        let pron = "";
        const pronMatch = cleanLine.match(/\[(.*?)\]/);
        if (pronMatch) {
          pron = `[${pronMatch[1]}]`;
          cleanLine = cleanLine.replace(/\[.*?\]/, "").trim();
        }

        // 3. 첫 번째 띄어쓰기를 기준으로 영단어와 뜻 분리
        const firstSpaceIdx = cleanLine.indexOf(" ");
        if (firstSpaceIdx === -1) return null;

        const en = cleanLine.substring(0, firstSpaceIdx).trim();
        const ko = cleanLine.substring(firstSpaceIdx + 1).trim();

        return {
          id: Date.now() + Math.random(),
          en,
          ko,
          pron,
          isStarred: false,
        };
      })
      .filter(Boolean);

    if (newWords.length > 0) {
      setWords([...words, ...newWords]);
      setBulkText("");
      alert(`${newWords.length}개의 단어가 추가되었습니다!`);
    }
  };

  // 삭제
  const deleteWord = (id) => {
    setWords(words.filter((w) => w.id !== id));
  };

  // 로그인 안 된 화면
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-3xl font-bold mb-6 text-blue-600">Smart Voca</h1>
        <p className="mb-8 text-gray-600">
          나만의 영단어장을 만들고 기기 상관없이 학습하세요.
        </p>
        <button
          onClick={handleLogin}
          className="flex items-center gap-2 bg-white px-6 py-3 rounded-lg shadow hover:bg-gray-50 font-bold"
        >
          <LogIn size={20} /> 구글 계정으로 로그인
        </button>
      </div>
    );
  }

  const currentList =
    activeTab === "star" ? words.filter((w) => w.isStarred) : words;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col max-w-md mx-auto shadow-lg relative">
      {/* 헤더 */}
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Smart Voca</h1>
        <button
          onClick={handleLogout}
          className="text-sm flex items-center gap-1 hover:text-gray-200"
        >
          <LogOut size={16} /> 로그아웃
        </button>
      </header>

      {/* 탭 메뉴 */}
      <div className="flex bg-white shadow-sm text-sm font-medium">
        <button
          className={`flex-1 py-3 ${
            activeTab === "learn"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => {
            setActiveTab("learn");
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
        >
          전체 학습
        </button>
        <button
          className={`flex-1 py-3 ${
            activeTab === "star"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => {
            setActiveTab("star");
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
        >
          ⭐ 별표 복습
        </button>
        <button
          className={`flex-1 py-3 ${
            activeTab === "add"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("add")}
        >
          추가
        </button>
        <button
          className={`flex-1 py-3 ${
            activeTab === "manage"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("manage")}
        >
          관리
        </button>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* 학습 & 별표 탭 */}
        {(activeTab === "learn" || activeTab === "star") && (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-500 font-medium">
                {currentList.length > 0
                  ? `${currentIndex + 1} / ${currentList.length}`
                  : "0 / 0"}
              </span>
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-gray-400" />
                <select
                  value={ttsRate}
                  onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                  className="text-sm bg-transparent border-none outline-none"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={0.8}>0.8x</option>
                  <option value={1.0}>1.0x</option>
                  <option value={1.2}>1.2x</option>
                </select>
              </div>
            </div>

            {currentList.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                {activeTab === "star"
                  ? "별표 표시한 단어가 없습니다."
                  : "단어를 추가해주세요."}
              </div>
            ) : (
              <>
                <div
                  className="relative w-full h-64 cursor-pointer"
                  style={{ perspective: "1000px" }}
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <div
                    className="w-full h-full relative transition-transform duration-500"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: isFlipped ? "rotateY(180deg)" : "rotateY(0)",
                    }}
                  >
                    {/* 앞면 (영어) */}
                    <div
                      className="absolute w-full h-full bg-white rounded-2xl shadow-md flex flex-col items-center justify-center p-6 backface-hidden"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(currentList[currentIndex].id);
                        }}
                        className="absolute top-4 left-4 p-2"
                      >
                        <Star
                          size={24}
                          className={
                            currentList[currentIndex].isStarred
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-gray-300"
                          }
                        />
                      </button>
                      <h2 className="text-4xl font-bold text-gray-800">
                        {currentList[currentIndex].en}
                      </h2>
                      {currentList[currentIndex].pron && (
                        <p className="text-gray-400 mt-2 text-lg">
                          {currentList[currentIndex].pron}
                        </p>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speak(currentList[currentIndex].en);
                        }}
                        className="absolute top-4 right-4 p-2 text-blue-500 bg-blue-50 rounded-full hover:bg-blue-100"
                      >
                        <Volume2 size={24} />
                      </button>
                    </div>

                    {/* 뒷면 (한글) */}
                    <div
                      className="absolute w-full h-full bg-blue-50 rounded-2xl shadow-md flex items-center justify-center p-6 backface-hidden"
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                    >
                      <h2 className="text-3xl font-bold text-blue-800 text-center">
                        {currentList[currentIndex].ko}
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => prevWord(currentList)}
                    className="flex-1 py-3 bg-white text-gray-800 rounded-xl shadow font-bold hover:bg-gray-50"
                  >
                    이전
                  </button>
                  <button
                    onClick={() => nextWord(currentList)}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl shadow font-bold hover:bg-blue-700"
                  >
                    다음
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 추가 탭 */}
        {activeTab === "add" && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h3 className="font-bold text-lg mb-3">단일 단어 추가</h3>
              <input
                type="text"
                placeholder="영어 단어"
                className="w-full mb-2 p-2 border rounded"
                value={newEn}
                onChange={(e) => setNewEn(e.target.value)}
              />
              <input
                type="text"
                placeholder="발음 기호 (선택)"
                className="w-full mb-2 p-2 border rounded"
                value={newPron}
                onChange={(e) => setNewPron(e.target.value)}
              />
              <input
                type="text"
                placeholder="한글 뜻"
                className="w-full mb-3 p-2 border rounded"
                value={newKo}
                onChange={(e) => setNewKo(e.target.value)}
              />
              <button
                onClick={addSingleWord}
                className="w-full py-2 bg-blue-600 text-white rounded font-bold"
              >
                추가하기
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h3 className="font-bold text-lg mb-3">
                대량 추가 (복사/붙여넣기)
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                "1. clumsy [ˈklʌmzi] 어색한" 형식으로 붙여넣으면 숫자와 발음
                기호를 자동 인식합니다.
              </p>
              <textarea
                placeholder="단어와 뜻을 붙여넣으세요..."
                className="w-full h-32 p-2 border rounded mb-3 text-sm"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <button
                onClick={addBulkWords}
                className="w-full py-2 bg-gray-800 text-white rounded font-bold"
              >
                대량 추가하기
              </button>
            </div>
          </div>
        )}

        {/* 관리 탭 */}
        {activeTab === "manage" && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold">총 {words.length}개</h3>
            </div>
            <ul className="divide-y max-h-[60vh] overflow-y-auto">
              {words.map((w) => (
                <li
                  key={w.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div>
                    <p className="font-bold flex items-center gap-2">
                      {w.en}{" "}
                      {w.isStarred && (
                        <Star
                          size={14}
                          className="text-yellow-400 fill-yellow-400"
                        />
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {w.pron} {w.ko}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteWord(w.id)}
                    className="text-red-500 p-2 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
