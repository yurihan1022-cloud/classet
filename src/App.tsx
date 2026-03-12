// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { Crown, Lock, User, Check, Trash2, Award, UserPlus, Info, AlertCircle, X, Unlock, Clock, Power, RefreshCw, Loader2 } from 'lucide-react';

// ==========================================
// [1] 파이어베이스 시스템 키값
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAvm-hhJYNme2nVQANq8wGOyPJlziZH3Nc", 
  authDomain: "classelection-b07c7.firebaseapp.com",
  projectId: "classelection-b07c7",
  storageBucket: "classelection-b07c7.firebasestorage.app",
  messagingSenderId: "648798338183",
  appId: "1:648798338183:web:8641f9b16d4067df8a0c22"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'hyyyr010544190'; 

export default function App() {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // 투표 중복 클릭 방지용
  const [candidates, setCandidates] = useState([]);
  const [votes, setVotes] = useState([]);
  const [votingStatus, setVotingStatus] = useState({ president: false, vice: false });
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [activeTab, setActiveTab] = useState('vote'); 
  const [electionType, setElectionType] = useState('president'); 
  const [studentId, setStudentId] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [reason, setReason] = useState('');
  const [newCandidateName, setNewCandidateName] = useState('');
  const [toast, setToast] = useState(null);

  // 언어 설정 및 번역 방지
  useEffect(() => {
    document.documentElement.lang = 'ko';
    let meta = document.querySelector('meta[name="google"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'google';
      meta.content = 'notranslate';
      document.head.appendChild(meta);
    }
  }, []);

  // 1. 보안 인증 로직
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("인증 에러:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsInitializing(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. 실시간 데이터 동기화
  useEffect(() => {
    if (!user || !db) return;

    const candidatesRef = collection(db, 'artifacts', appId, 'public', 'data', 'candidates');
    const unsubCandidates = onSnapshot(candidatesRef, (snapshot) => {
      setCandidates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const votesRef = collection(db, 'artifacts', appId, 'public', 'data', 'votes');
    const unsubVotes = onSnapshot(votesRef, (snapshot) => {
      setVotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const statusRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'votingStatus');
    const unsubStatus = onSnapshot(statusRef, (docSnap) => {
      if (docSnap.exists()) setVotingStatus(docSnap.data());
    });

    return () => {
      unsubCandidates();
      unsubVotes();
      unsubStatus();
    };
  }, [user, db]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === '0508') {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setActiveTab('admin');
      showToast('관리자 모드로 접속되었습니다.');
    } else {
      showToast('비밀번호가 틀렸습니다.', 'error');
    }
    setAdminPassword('');
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setActiveTab('vote');
    showToast('관리자 모드가 종료되었습니다.');
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    if (!newCandidateName.trim() || !user) return;

    const currentCandidates = candidates.filter(c => c.type === electionType);
    if (currentCandidates.length >= 5) {
      alert('후보자는 최대 5명까지만 등록할 수 있습니다.');
      return;
    }

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'candidates'), {
        name: newCandidateName.trim(),
        type: electionType,
        createdAt: new Date().toISOString()
      });
      setNewCandidateName('');
      showToast('후보자가 등록되었습니다.');
    } catch (error) {
      alert(`🚨 등록 실패! 오류: ${error.message}`);
    }
  };

  const handleDeleteCandidate = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', id));
      showToast('후보자가 삭제되었습니다.');
    } catch (err) { alert("삭제 실패: " + err.message); }
  };

  const toggleVotingStatus = async () => {
    try {
      const statusRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'votingStatus');
      const isCurrentlyClosed = votingStatus[electionType];
      await setDoc(statusRef, { [electionType]: !isCurrentlyClosed }, { merge: true });
      showToast(!isCurrentlyClosed ? '투표가 마감되었습니다.' : '투표가 다시 열렸습니다.');
    } catch (err) { alert("상태 변경 실패: " + err.message); }
  };

  // 🌟 [핵심] 중복 투표 방지 로직이 강화된 투표 함수
  const handleVote = async (e) => {
    e.preventDefault();
    
    // 1. 기본 체크
    if (votingStatus[electionType]) return alert('현재 투표가 마감되었습니다.');
    if (!studentId.trim() || !selectedCandidate || !reason.trim()) return alert('모든 항목을 입력해주세요.');
    if (!user) return alert('서버 연결 중입니다. 잠시만 기다려주세요.');

    // 2. [강력 중복 방지] 현재 선거 타입(반장/부반장)에 이 학번이 이미 있는지 실시간 검사
    const normalizedId = studentId.trim();
    const alreadyVoted = votes.some(v => v.studentId === normalizedId && v.type === electionType);
    
    if (alreadyVoted) {
      alert(`🚨 투표 실패!\n\n학번 [${normalizedId}]님은 이미 ${electionType === 'president' ? '반장' : '부반장'} 투표를 완료하셨습니다.\n중복 투표는 불가능합니다.`);
      return;
    }

    // 3. 투표 처리 (버튼 잠금)
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'votes'), {
        studentId: normalizedId,
        candidateId: selectedCandidate,
        reason: reason.trim(),
        type: electionType,
        timestamp: new Date().toISOString()
      });
      setStudentId(''); setSelectedCandidate(''); setReason('');
      showToast('투표가 성공적으로 완료되었습니다! 🎉');
      setActiveTab('results');
    } catch (err) { 
      alert("투표 저장 중 오류가 발생했습니다: " + err.message); 
    } finally {
      setIsSubmitting(false); // 버튼 잠금 해제
    }
  };

  const currentCandidates = useMemo(() => candidates.filter(c => c.type === electionType).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [candidates, electionType]);
  const currentVotes = useMemo(() => votes.filter(v => v.type === electionType), [votes, electionType]);
  const results = useMemo(() => {
    const counts = {};
    currentCandidates.forEach(c => { counts[c.id] = { ...c, voteCount: 0, voterReasons: [] }; });
    currentVotes.forEach(v => {
      if (counts[v.candidateId]) {
        counts[v.candidateId].voteCount += 1;
        counts[v.candidateId].voterReasons.push({ reason: v.reason, studentId: v.studentId });
      }
    });
    const resultsArray = Object.values(counts);
    const maxVotes = Math.max(...resultsArray.map(r => r.voteCount), 0);
    return resultsArray.map(r => ({ ...r, isWinner: r.voteCount > 0 && r.voteCount === maxVotes })).sort((a, b) => b.voteCount - a.voteCount);
  }, [currentCandidates, currentVotes]);

  const isCurrentElectionClosed = votingStatus[electionType];

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">투표소에 입장하는 중...</h2>
        <p className="text-slate-500 text-sm">잠시만 기다려주시면 바로 시작합니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Award className="text-yellow-500 w-8 h-8" />
            <h1 className="text-2xl font-bold text-slate-800">우리반 임원 선거</h1>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto border border-slate-200">
            <button onClick={() => setElectionType('president')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all ${electionType === 'president' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500'}`}>👑 반장 선거</button>
            <button onClick={() => setElectionType('vice')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all ${electionType === 'vice' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500'}`}>🌟 부반장 선거</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex justify-center mb-8 border-b border-slate-200">
          <button onClick={() => setActiveTab('vote')} className={`px-4 py-3 font-medium border-b-2 transition-all ${activeTab === 'vote' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>투표하기</button>
          <button onClick={() => setActiveTab('results')} className={`px-4 py-3 font-medium border-b-2 transition-all ${activeTab === 'results' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>결과보기</button>
          {isAdmin && <button onClick={() => setActiveTab('admin')} className={`px-4 py-3 font-medium border-b-2 transition-all flex items-center gap-1 ${activeTab === 'admin' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500'}`}><Lock className="w-4 h-4" /> 관리자 메뉴</button>}
        </div>

        {activeTab === 'vote' && (
          <div className="bg-white rounded-2xl shadow-sm border p-6 sm:p-8 animate-in fade-in duration-500">
            {isCurrentElectionClosed ? (
              <div className="text-center py-12 flex flex-col items-center">
                <Lock className="w-16 h-16 text-slate-200 mb-4" />
                <h3 className="text-xl font-bold text-slate-700 mb-2">투표가 마감되었습니다</h3>
                <p className="text-slate-500 mb-6">선생님이 결과를 공개할 때까지 기다려주세요!</p>
                <button onClick={() => setActiveTab('results')} className="bg-blue-50 text-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-100 transition-colors">결과 확인하기</button>
              </div>
            ) : currentCandidates.length === 0 ? (
              <div className="text-center py-16 text-slate-400 flex flex-col items-center">
                <Info className="w-12 h-12 mb-4 opacity-20" />
                <p>아직 등록된 후보가 없습니다.</p>
              </div>
            ) : (
              <form onSubmit={handleVote} className="space-y-8">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
                   <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                   <p className="text-sm text-blue-700 leading-relaxed">반장과 부반장 선거에 각각 <b>한 번씩만</b> 투표할 수 있습니다. <br/>학번은 선생님만 확인할 수 있으니 안심하고 소신껏 투표하세요!</p>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">1. 학번을 적어주세요</label>
                  <input type="text" required placeholder="예: 10101" className="w-full sm:w-1/2 px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 outline-none transition-all text-lg" value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={isSubmitting} />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">2. 투표할 후보를 선택하세요</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentCandidates.map(c => (
                      <label key={c.id} className={`flex items-center p-5 rounded-2xl border-2 cursor-pointer transition-all ${selectedCandidate === c.id ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-50 hover:bg-slate-50'}`}>
                        <input type="radio" name="candidate" value={c.id} checked={selectedCandidate === c.id} onChange={(e) => setSelectedCandidate(e.target.value)} className="w-6 h-6 text-blue-600" disabled={isSubmitting} />
                        <span className="ml-4 font-bold text-xl">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">3. 뽑은 이유를 적어주세요</label>
                  <textarea required placeholder="이 후보가 왜 우리 반을 잘 이끌 것 같은지 이유를 적어주세요." className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 outline-none h-32 resize-none transition-all" value={reason} onChange={(e) => setReason(e.target.value)} disabled={isSubmitting} />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black py-5 rounded-2xl shadow-xl transition-all flex justify-center items-center gap-3 text-xl">
                  {isSubmitting ? (
                    <><Loader2 className="w-6 h-6 animate-spin" /> 처리 중...</>
                  ) : (
                    <><Check className="w-6 h-6" /> 투표 완료하기</>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {!isAdmin && !isCurrentElectionClosed ? (
               <div className="text-center py-20 bg-white rounded-2xl border flex flex-col items-center">
                 <Clock className="w-16 h-16 text-blue-300 mb-4 animate-pulse" />
                 <h3 className="text-2xl font-bold text-slate-700 mb-2">현재 투표가 진행 중입니다</h3>
                 <p className="text-slate-500">선생님이 투표를 마감하시면 <br/>친구들이 적은 이유와 당선자를 볼 수 있습니다!</p>
               </div>
            ) : results.length === 0 ? (
               <div className="text-center py-10 bg-white rounded-2xl border text-slate-400">투표 결과가 없습니다.</div>
            ) : (
              results.map((result) => (
                <div key={result.id} className={`bg-white rounded-2xl shadow-sm border p-6 relative overflow-hidden ${result.isWinner && isCurrentElectionClosed ? 'border-yellow-400 ring-4 ring-yellow-400 ring-opacity-30' : 'border-slate-100'}`}>
                  {result.isWinner && isCurrentElectionClosed && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 font-black px-6 py-2 rounded-bl-2xl flex items-center gap-2 shadow-lg z-10 animate-bounce mt-2 mr-2">👑 당선 🎉</div>}
                  <div className="flex items-center justify-between mb-6 mt-2">
                    <h3 className="text-3xl font-black flex items-center gap-2 text-slate-800"><User className="text-slate-400 w-8 h-8" /> {result.name}</h3>
                    <div className="text-center bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 shadow-inner">
                      <span className={`text-4xl font-black ${result.isWinner && isCurrentElectionClosed ? 'text-yellow-500' : 'text-blue-600'}`}>{result.voteCount}</span>
                      <span className="text-slate-500 ml-2 font-bold text-xl">표</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <h4 className="text-sm font-black text-slate-600 mb-4 flex items-center gap-2"><Info className="w-4 h-4 text-blue-500" /> 친구들이 이 후보를 선택한 이유</h4>
                    {result.voterReasons.length > 0 ? (
                      <ul className="space-y-3">
                        {result.voterReasons.map((v, idx) => (
                          <li key={idx} className="text-slate-700 bg-white p-4 rounded-xl border border-slate-200 text-sm shadow-sm flex flex-col gap-2 leading-relaxed">
                            {isAdmin && <div className="flex items-center gap-1.5 text-red-600 font-black text-xs bg-red-50 w-fit px-2 py-1 rounded border border-red-100"><Lock className="w-3 h-3" /> 학번: {v.studentId}</div>}
                            <span className="text-slate-800 font-medium italic">"{v.reason}"</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-slate-400 italic">아직 투표 내역이 없습니다.</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className={`rounded-2xl border-2 p-6 flex flex-col sm:flex-row items-center justify-between gap-6 ${isCurrentElectionClosed ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'}`}>
               <div>
                 <h3 className="text-xl font-black mb-1 flex items-center gap-2 text-slate-800">
                   {isCurrentElectionClosed ? <Lock className="text-slate-400" /> : <Unlock className="text-blue-500" />}
                   투표 진행 상태 관리
                 </h3>
                 <p className="text-sm text-slate-600">{isCurrentElectionClosed ? '학생들의 투표가 중단되었으며, 모두가 결과를 볼 수 있습니다.' : '학생들이 투표 중이며, 결과는 선생님만 볼 수 있습니다.'}</p>
               </div>
               <button onClick={toggleVotingStatus} className={`flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-white shadow-lg transition-all w-full sm:w-auto text-lg ${isCurrentElectionClosed ? 'bg-slate-800 hover:bg-slate-900' : 'bg-red-500 hover:bg-red-600 animate-pulse'}`}>
                 <Power className="w-6 h-6" /> {isCurrentElectionClosed ? '투표 다시 시작하기' : '투표 지금 마감하기'}
               </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-slate-800"><UserPlus className="w-5 h-5 text-blue-500" /> 후보 관리 (최대 5명)</h3>
              <form onSubmit={handleAddCandidate} className="flex gap-3 mb-8">
                <input type="text" placeholder="새로운 후보자 이름 입력" value={newCandidateName} onChange={(e) => setNewCandidateName(e.target.value)} className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 outline-none transition-all font-bold" disabled={isCurrentElectionClosed} />
                <button type="submit" disabled={currentCandidates.length >= 5 || isCurrentElectionClosed} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-black disabled:bg-slate-200 shadow-md">등록</button>
              </form>
              <div className="space-y-3">
                {currentCandidates.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
                    <span className="font-black text-slate-800 text-lg">{c.name}</span>
                    <button onClick={() => handleDeleteCandidate(c.id)} disabled={isCurrentElectionClosed} className="p-2 text-red-400 hover:text-red-600 transition-colors disabled:opacity-30"><Trash2 className="w-5 h-5" /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-yellow-50 rounded-2xl border-2 border-yellow-200 p-6 shadow-sm">
              <h3 className="font-black text-yellow-800 mb-3 flex items-center gap-2 text-lg"><AlertCircle className="w-6 h-6" /> 관리자 선생님을 위한 팁</h3>
              <ul className="space-y-2 text-yellow-900 font-medium">
                <li className="flex gap-2 text-sm"><span className="text-yellow-600 font-bold">•</span> <b>[결과보기]</b> 탭에서 각 이유 위에 빨간색으로 표시된 <b>학번</b>을 확인하실 수 있습니다.</li>
                <li className="flex gap-2 text-sm"><span className="text-yellow-600 font-bold">•</span> 학생들이 중복 투표를 시도하면 시스템이 자동으로 차단 팝업을 띄웁니다.</li>
                <li className="flex gap-2 text-sm"><span className="text-yellow-600 font-bold">•</span> 모든 투표가 끝나면 <b>[투표 지금 마감하기]</b>를 눌러 당선자를 발표해 주세요!</li>
              </ul>
              <button onClick={handleAdminLogout} className="mt-8 w-full bg-yellow-200 hover:bg-yellow-300 text-yellow-900 font-black py-4 rounded-2xl transition-all shadow-sm">관리자 모드 로그아웃</button>
            </div>
          </div>
        )}
      </main>

      {showAdminLogin && !isAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl relative border border-slate-100">
            <button onClick={() => setShowAdminLogin(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-6 h-6" /></button>
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6 mx-auto"><Lock className="w-8 h-8 text-slate-800" /></div>
            <h3 className="text-2xl font-black text-center mb-2 text-slate-800">관리자 인증</h3>
            <p className="text-sm text-slate-500 text-center mb-8">선생님 전용 관리 페이지입니다.</p>
            <form onSubmit={handleAdminLogin}>
              <input type="password" placeholder="비밀번호 입력" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-slate-800 outline-none mb-6 text-center text-xl font-bold tracking-widest transition-all" autoFocus />
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl text-lg shadow-lg transition-all">접속하기</button>
            </form>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-100 py-3 px-4 text-center z-10">
         {!isAdmin ? (
           <button onClick={() => setShowAdminLogin(true)} className="text-xs text-slate-400 font-bold flex items-center justify-center gap-1.5 mx-auto hover:text-slate-600 transition-colors"><Lock className="w-3 h-3" /> 관리자 로그인</button>
         ) : <div className="text-xs text-red-600 font-black flex items-center justify-center gap-1.5 animate-pulse"><Lock className="w-3 h-3" /> 관리자 모드 실행 중</div>}
      </footer>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-300">
          <div className={`${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'} text-white px-8 py-4 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-3 border border-white/10`}>
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Check className="w-5 h-5 text-green-400" />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
