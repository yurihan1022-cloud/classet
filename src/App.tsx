import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import {
  Crown,
  Lock,
  User,
  Check,
  Trash2,
  Award,
  UserPlus,
  Info,
  AlertCircle,
  X,
  Unlock,
  Clock,
  Power,
} from "lucide-react";

// ==========================================
// Firebase 설정 (CodeSandbox 사용 시 주의)
// ==========================================
// CodeSandbox에서 다른 사람과 데이터를 공유하려면 본인의 Firebase 프로젝트 키가 필요합니다.
const firebaseConfig =
  typeof __firebase_config !== "undefined"
    ? JSON.parse(__firebase_config)
    : {
        apiKey: "AIzaSyAvm-hhJYNme2nVQANq8wGOyPJlziZH3Nc",
        authDomain: "classelection-b07c7.firebaseapp.com",
        projectId: "classelection-b07c7",
        storageBucket: "classelection-b07c7.firebasestorage.app",
        messagingSenderId: "648798338183",
        appId: "1:648798338183:web:8641f9b16d4067df8a0c22", // 👈 선생님이 정하신 키값!
      };

// Firebase 초기화 (오류 방지를 위해 try-catch 적용)
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase 초기화 에러 (설정값을 확인하세요):", error);
}

// 👈 우리 반 투표 데이터를 묶어줄 고유 방 번호로 선생님의 키값을 지정했습니다..
// 캔버스 자체 미리보기 환경과 코드샌드박스 모두에서 권한 오류가 나지 않도록 수정했습니다.
const appId = typeof __app_id !== "undefined" ? __app_id : "hyyyr010544190";

export default function App() {
  const [user, setUser] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [votes, setVotes] = useState([]);
  const [votingStatus, setVotingStatus] = useState({
    president: false,
    vice: false,
  }); // false: 진행중, true: 마감됨

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const [activeTab, setActiveTab] = useState("vote"); // 'vote', 'results', 'admin'
  const [electionType, setElectionType] = useState("president"); // 'president', 'vice'

  const [studentId, setStudentId] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [reason, setReason] = useState("");

  const [newCandidateName, setNewCandidateName] = useState("");

  const [toast, setToast] = useState(null);

  // 🌟 [여기에 추가!] 브라우저 자동 번역 방지 설정
  useEffect(() => {
    // 1. 문서 언어를 한국어로 명시
    document.documentElement.lang = "ko";

    // 2. 구글 번역 팝업 강제 차단 메타 태그 추가
    let meta = document.querySelector('meta[name="google"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "google";
      meta.content = "notranslate";
      document.head.appendChild(meta);
    }
  }, []);

  // 1. Initialize Firebase Auth
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== "undefined" &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data
  useEffect(() => {
    if (!user || !db) return;

    // 후보자 목록 가져오기
    const candidatesRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "candidates"
    );
    const unsubCandidates = onSnapshot(
      candidatesRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCandidates(data);
      },
      (error) => console.error("Candidates fetch error:", error)
    );

    // 투표 결과 가져오기
    const votesRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "votes"
    );
    const unsubVotes = onSnapshot(
      votesRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setVotes(data);
      },
      (error) => console.error("Votes fetch error:", error)
    );

    // 투표 진행/마감 상태 가져오기
    const statusRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "settings",
      "votingStatus"
    );
    const unsubStatus = onSnapshot(
      statusRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setVotingStatus(docSnap.data());
        }
      },
      (error) => console.error("Status fetch error:", error)
    );

    return () => {
      unsubCandidates();
      unsubVotes();
      unsubStatus();
    };
  }, [user]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === "0508") {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setActiveTab("admin"); // 로그인 시 관리자 메뉴로 이동
      showToast("관리자 모드로 접속되었습니다.");
    } else {
      showToast("비밀번호가 틀렸습니다.", "error");
    }
    setAdminPassword("");
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setActiveTab("vote");
    showToast("관리자 모드가 종료되었습니다.");
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    if (!newCandidateName.trim() || !db) return;

    const currentCandidates = candidates.filter((c) => c.type === electionType);
    if (currentCandidates.length >= 5) {
      showToast("후보자는 최대 5명까지만 등록할 수 있습니다.", "error");
      return;
    }

    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "candidates"),
        {
          name: newCandidateName.trim(),
          type: electionType,
          createdAt: new Date().toISOString(),
        }
      );
      setNewCandidateName("");
      showToast("후보자가 등록되었습니다.");
    } catch (error) {
      showToast("등록 중 오류가 발생했습니다.", "error");
    }
  };

  const handleDeleteCandidate = async (id) => {
    if (!db) return;
    try {
      await deleteDoc(
        doc(db, "artifacts", appId, "public", "data", "candidates", id)
      );
      showToast("후보자가 삭제되었습니다.");
    } catch (error) {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  };

  const toggleVotingStatus = async () => {
    if (!db) return;
    try {
      const statusRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "settings",
        "votingStatus"
      );
      const isCurrentlyClosed = votingStatus[electionType];
      await setDoc(
        statusRef,
        {
          [electionType]: !isCurrentlyClosed,
        },
        { merge: true }
      );
      showToast(
        !isCurrentlyClosed
          ? "투표가 마감되었습니다."
          : "투표가 다시 열렸습니다."
      );
    } catch (error) {
      showToast("상태 변경 중 오류가 발생했습니다.", "error");
    }
  };

  const handleVote = async (e) => {
    e.preventDefault();
    if (votingStatus[electionType]) {
      showToast("현재 투표가 마감되었습니다.", "error");
      return;
    }

    if (!studentId.trim() || !selectedCandidate || !reason.trim()) {
      showToast("학번, 후보, 투표 이유를 모두 입력해주세요.", "error");
      return;
    }

    const hasVoted = votes.some(
      (v) => v.studentId === studentId.trim() && v.type === electionType
    );
    if (hasVoted) {
      showToast(
        `이미 ${
          electionType === "president" ? "반장" : "부반장"
        } 선거에 투표했습니다!`,
        "error"
      );
      return;
    }

    if (!db) {
      showToast("데이터베이스 연결 오류", "error");
      return;
    }

    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "votes"),
        {
          studentId: studentId.trim(),
          candidateId: selectedCandidate,
          reason: reason.trim(),
          type: electionType,
          timestamp: new Date().toISOString(),
        }
      );
      setStudentId("");
      setSelectedCandidate("");
      setReason("");
      showToast("투표가 완료되었습니다! 감사합니다 🎉");
      setActiveTab("results");
    } catch (error) {
      showToast("투표 중 오류가 발생했습니다.", "error");
    }
  };

  const currentCandidates = useMemo(() => {
    return candidates
      .filter((c) => c.type === electionType)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [candidates, electionType]);

  const currentVotes = useMemo(() => {
    return votes.filter((v) => v.type === electionType);
  }, [votes, electionType]);

  const results = useMemo(() => {
    const counts = {};
    currentCandidates.forEach((c) => {
      counts[c.id] = { ...c, voteCount: 0, voterReasons: [] };
    });

    currentVotes.forEach((v) => {
      if (counts[v.candidateId]) {
        counts[v.candidateId].voteCount += 1;
        counts[v.candidateId].voterReasons.push({
          reason: v.reason,
          studentId: v.studentId,
        });
      }
    });

    const resultsArray = Object.values(counts);
    const maxVotes = Math.max(...resultsArray.map((r) => r.voteCount), 0);

    return resultsArray
      .map((r) => ({
        ...r,
        isWinner: r.voteCount > 0 && r.voteCount === maxVotes,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);
  }, [currentCandidates, currentVotes]);

  const isCurrentElectionClosed = votingStatus[electionType];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Award className="text-yellow-500 w-8 h-8" />
            <h1 className="text-2xl font-bold text-slate-800">
              우리반 임원 선거
            </h1>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
            <button
              onClick={() => {
                setElectionType("president");
                setActiveTab(
                  isAdmin && activeTab === "admin" ? "admin" : "vote"
                );
              }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                electionType === "president"
                  ? "bg-white shadow text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              반장 선거
            </button>
            <button
              onClick={() => {
                setElectionType("vice");
                setActiveTab(
                  isAdmin && activeTab === "admin" ? "admin" : "vote"
                );
              }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                electionType === "vice"
                  ? "bg-white shadow text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              부반장 선거
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Navigation Tabs - 항상 보이도록 수정됨 */}
        <div className="flex justify-center mb-8 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("vote")}
            className={`px-4 sm:px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "vote"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            투표하기
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className={`px-4 sm:px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "results"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            결과보기
          </button>
          {/* 관리자일 때만 보이는 '관리자 메뉴' 탭 */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-4 sm:px-6 py-3 font-medium border-b-2 transition-colors flex items-center gap-1 ${
                activeTab === "admin"
                  ? "border-red-500 text-red-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Lock className="w-4 h-4" /> 관리자 메뉴
            </button>
          )}
        </div>

        <div className="mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2 mb-2">
              {electionType === "president" ? "👑 반장 선거" : "🌟 부반장 선거"}
              {isAdmin && (
                <span className="text-sm bg-red-100 text-red-600 px-2 py-1 rounded-full ml-2">
                  관리자 모드
                </span>
              )}
            </h2>
            <p className="text-slate-500 text-sm">
              {activeTab === "vote" &&
                "소중한 한 표를 행사해주세요. 누구에게 투표했는지는 선생님만 알 수 있습니다!"}
              {activeTab === "results" && "현재까지의 투표 결과입니다."}
              {activeTab === "admin" &&
                "투표를 마감하거나 후보를 관리할 수 있습니다."}
            </p>
          </div>

          {/* Status Badge */}
          <div className="hidden sm:flex items-center">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm ${
                isCurrentElectionClosed
                  ? "bg-slate-700 text-white"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {isCurrentElectionClosed ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Unlock className="w-3.5 h-3.5" />
              )}
              {isCurrentElectionClosed ? "투표 마감됨" : "투표 진행중"}
            </span>
          </div>
        </div>

        {/* Mobile Status Badge */}
        <div className="sm:hidden mb-6">
          <span
            className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold items-center gap-1.5 shadow-sm ${
              isCurrentElectionClosed
                ? "bg-slate-700 text-white"
                : "bg-green-100 text-green-700"
            }`}
          >
            {isCurrentElectionClosed ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
            {isCurrentElectionClosed ? "투표 마감됨" : "투표 진행중"}
          </span>
        </div>

        {/* --- VOTING TAB --- */}
        {activeTab === "vote" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
            {isCurrentElectionClosed ? (
              <div className="text-center py-12 flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">
                  투표가 마감되었습니다
                </h3>
                <p className="text-slate-500 mb-6">
                  참여해주셔서 감사합니다. 상단의 '결과보기' 탭에서 결과를
                  확인하세요!
                </p>
                <button
                  onClick={() => setActiveTab("results")}
                  className="bg-blue-50 text-blue-600 px-6 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                >
                  결과 확인하러 가기
                </button>
              </div>
            ) : currentCandidates.length === 0 ? (
              <div className="text-center py-10 text-slate-400 flex flex-col items-center">
                <Info className="w-12 h-12 mb-3 text-slate-300" />
                <p>아직 등록된 후보가 없습니다.</p>
              </div>
            ) : (
              <form
                onSubmit={handleVote}
                className="space-y-6 animate-in fade-in duration-300"
              >
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    1. 본인의 학번을 적어주세요
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 10101"
                    className="w-full sm:w-1/2 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                  <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> 학번은 선생님만 볼 수 있어요!
                    안심하세요.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    2. 투표할 후보를 선택하세요
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentCandidates.map((c) => (
                      <label
                        key={c.id}
                        className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedCandidate === c.id
                            ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                            : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="candidate"
                          value={c.id}
                          checked={selectedCandidate === c.id}
                          onChange={(e) => setSelectedCandidate(e.target.value)}
                          className="w-5 h-5 text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <span className="ml-3 font-medium text-lg">
                          {c.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    3. 이 후보를 뽑은 이유는 무엇인가요?
                  </label>
                  <textarea
                    required
                    placeholder="예: 리더십이 뛰어나고 우리 반을 잘 이끌어 줄 것 같아서요!"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all h-28 resize-none"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors shadow-md flex justify-center items-center gap-2 text-lg"
                >
                  <Check className="w-5 h-5" /> 투표 완료하기
                </button>
              </form>
            )}
          </div>
        )}

        {/* --- RESULTS TAB --- */}
        {activeTab === "results" && (
          <div className="space-y-6">
            {!isAdmin && !isCurrentElectionClosed ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">
                  투표가 진행 중입니다
                </h3>
                <p className="text-slate-500">
                  선생님이 투표를 마감하면 결과를 확인할 수 있습니다.
                  <br />
                  조금만 기다려주세요!
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 text-slate-400 shadow-sm">
                투표 결과가 없습니다.
              </div>
            ) : (
              <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-6">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className={`bg-white rounded-2xl shadow-sm border p-6 relative overflow-hidden ${
                      result.isWinner && isCurrentElectionClosed
                        ? "border-yellow-400 ring-4 ring-yellow-400 ring-opacity-30"
                        : "border-slate-100"
                    }`}
                  >
                    {/* Winner Badge */}
                    {result.isWinner && isCurrentElectionClosed && (
                      <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 font-bold px-4 py-1.5 rounded-bl-xl flex items-center gap-1 shadow-sm">
                        <Crown className="w-4 h-4" /> 당선 🎉
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-4 mt-2">
                      <h3 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <User className="text-slate-400" /> {result.name}
                      </h3>
                      <div className="text-center bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                        <span
                          className={`text-3xl font-black ${
                            result.isWinner && isCurrentElectionClosed
                              ? "text-yellow-500"
                              : "text-blue-600"
                          }`}
                        >
                          {result.voteCount}
                        </span>
                        <span className="text-slate-500 ml-1 font-medium">
                          표
                        </span>
                      </div>
                    </div>

                    {/* Reasons Section */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                        <Info className="w-4 h-4" /> 친구들이 뽑은 이유
                      </h4>
                      {result.voterReasons.length > 0 ? (
                        <ul className="space-y-2">
                          {result.voterReasons.map((v, idx) => (
                            <li
                              key={idx}
                              className="text-slate-700 bg-white p-3 rounded-lg border border-slate-100 text-sm shadow-sm flex flex-col sm:flex-row gap-2"
                            >
                              {/* Admin sees Student ID */}
                              {isAdmin && (
                                <span className="inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap h-fit">
                                  학번: {v.studentId}
                                </span>
                              )}
                              <span className="flex-1 leading-relaxed">
                                "{v.reason}"
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400 italic">
                          아직 투표가 없습니다.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- ADMIN TAB --- */}
        {activeTab === "admin" && isAdmin && (
          <div className="space-y-6">
            {/* Voting Status Control */}
            <div
              className={`rounded-2xl shadow-sm border p-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${
                isCurrentElectionClosed
                  ? "bg-slate-50 border-slate-200"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 mb-1">
                  {isCurrentElectionClosed ? (
                    <Lock className="w-5 h-5 text-slate-500" />
                  ) : (
                    <Unlock className="w-5 h-5 text-blue-500" />
                  )}
                  투표 진행 상태 관리
                </h3>
                <p className="text-sm text-slate-500">
                  {isCurrentElectionClosed
                    ? "학생들의 투표가 제한되며, 아이들도 결과를 볼 수 있습니다."
                    : "학생들이 투표를 할 수 있으며, 결과는 선생님만 볼 수 있습니다."}
                </p>
              </div>

              <button
                onClick={toggleVotingStatus}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-sm w-full sm:w-auto ${
                  isCurrentElectionClosed
                    ? "bg-slate-700 hover:bg-slate-800"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                <Power className="w-5 h-5" />
                {isCurrentElectionClosed ? "투표 다시 열기" : "투표 마감하기"}
              </button>
            </div>

            {/* Candidate Registration */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                <UserPlus className="w-5 h-5 text-blue-500" /> 후보 관리 (최대
                5명)
              </h3>

              <form onSubmit={handleAddCandidate} className="flex gap-2 mb-6">
                <input
                  type="text"
                  placeholder="새로운 후보자 이름"
                  value={newCandidateName}
                  onChange={(e) => setNewCandidateName(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={isCurrentElectionClosed}
                />
                <button
                  type="submit"
                  disabled={
                    currentCandidates.length >= 5 || isCurrentElectionClosed
                  }
                  className="bg-slate-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-900 disabled:bg-slate-300 transition-colors"
                >
                  등록
                </button>
              </form>
              {isCurrentElectionClosed && (
                <p className="text-xs text-red-500 mb-4">
                  * 투표가 마감된 상태에서는 후보를 변경할 수 없습니다.
                </p>
              )}

              <ul className="space-y-2">
                {currentCandidates.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <span className="font-medium text-slate-700">{c.name}</span>
                    <button
                      onClick={() => handleDeleteCandidate(c.id)}
                      disabled={isCurrentElectionClosed}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
                {currentCandidates.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-4">
                    등록된 후보가 없습니다.
                  </p>
                )}
              </ul>
            </div>

            {/* Admin Notice */}
            <div className="bg-yellow-50 rounded-2xl shadow-sm border border-yellow-100 p-6">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-yellow-800">
                <AlertCircle className="w-5 h-5" /> 관리자 안내
              </h3>
              <ul className="text-sm text-yellow-700 leading-relaxed list-disc list-inside space-y-1">
                <li>
                  상단의 <strong>'결과보기'</strong> 탭으로 이동하시면 실시간
                  결과와 <b>학생들의 학번</b>을 확인할 수 있습니다.
                </li>
                <li>
                  학생들에게 결과를 공개하려면 반드시 <b>[투표 마감하기]</b>{" "}
                  버튼을 눌러주세요.
                </li>
              </ul>
              <button
                onClick={handleAdminLogout}
                className="mt-4 bg-yellow-200 text-yellow-800 px-4 py-2 rounded-lg font-medium hover:bg-yellow-300 transition-colors text-sm w-full sm:w-auto"
              >
                관리자 모드 로그아웃
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Admin Login Modal */}
      {showAdminLogin && !isAdmin && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowAdminLogin(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-slate-800">
              <Lock className="w-5 h-5 text-slate-800" /> 관리자 접속
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              선생님 전용 메뉴입니다. 비밀번호를 입력해주세요.
            </p>
            <form onSubmit={handleAdminLogin}>
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 mb-4 focus:ring-2 focus:ring-slate-800 outline-none transition-all"
                autoFocus
              />
              <button
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-colors"
              >
                접속하기
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer / Admin Toggle */}
      <footer className="fixed bottom-0 w-full bg-slate-100 border-t border-slate-200 py-3 px-4 text-center z-10">
        {!isAdmin ? (
          <button
            onClick={() => setShowAdminLogin(true)}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium flex items-center justify-center gap-1 mx-auto"
          >
            <Lock className="w-3 h-3" /> 관리자 로그인
          </button>
        ) : (
          <div className="text-xs text-red-500 font-medium flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" /> 관리자 모드 활성화됨
          </div>
        )}
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <div
            className={`${
              toast.type === "error" ? "bg-red-600" : "bg-slate-800"
            } text-white px-6 py-3 rounded-full shadow-lg font-medium text-sm flex items-center gap-2 whitespace-nowrap`}
          >
            {toast.type === "error" ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
