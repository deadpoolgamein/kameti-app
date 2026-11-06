import React, { useState, useEffect, useRef } from "react";

export default function App() {
  const [kametiName, setKametiName] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [adminUpi, setAdminUpi] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const fileInputRef = useRef(null);

  const [kametiData, setKametiData] = useState(() => {
    const saved = localStorage.getItem("kameti_app_pro_data");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (kametiData) {
      localStorage.setItem("kameti_app_pro_data", JSON.stringify(kametiData));
    }
  }, [kametiData]);

  // One-time Lucky Draw Lineup
  const startNewKameti = () => {
    const members = memberInput
      .split("\n")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    if (!kametiName || !monthlyAmount || members.length < 2) {
      alert("Kameti name, amount aur kam se kam 2 members zaroor daalein!");
      return;
    }

    const shuffled = [...members];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const lineup = shuffled.map((name, index) => ({
      turnMonth: index + 1,
      memberName: name,
    }));

    const payments = {};
    for (let m = 1; m <= lineup.length; m++) {
      payments[m] = {};
      members.forEach((mem) => {
        payments[m][mem] = { status: false, mode: "Cash", date: null };
      });
    }

    setKametiData({
      name: kametiName,
      amount: Number(monthlyAmount),
      totalPool: Number(monthlyAmount) * members.length,
      adminUpi: adminUpi.trim(),
      lineup,
      payments,
      currentMonth: 1,
    });
  };

  // Toggle Payment Status & Mode
  const updatePaymentStatus = (month, member, status, mode = "Cash") => {
    setKametiData((prev) => ({
      ...prev,
      payments: {
        ...prev.payments,
        [month]: {
          ...prev.payments[month],
          [member]: {
            status,
            mode,
            date: status ? new Date().toLocaleDateString("en-IN") : null,
          },
        },
      },
    }));
  };

  // WhatsApp: Send Group Lineup
  const sendLineupToWhatsApp = () => {
    let msg = `🎉 *${kametiData.name} - Lucky Draw Lineup* 🎉\n`;
    msg += `💰 Monthly Kisht: ₹${kametiData.amount} | Pool: ₹${kametiData.totalPool}\n`;
    if (kametiData.adminUpi) msg += `📲 UPI ID: ${kametiData.adminUpi}\n`;
    msg += `\n*Payout Schedule:*\n`;
    kametiData.lineup.forEach((item) => {
      msg += `Month ${item.turnMonth}: *${item.memberName}*\n`;
    });
    msg += `\n_Kripya har mahine ki 10 tareekh tak payment complete karein._`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // WhatsApp: Send Monthly Group Summary
  const sendMonthStatusToWhatsApp = (month) => {
    const winner = kametiData.lineup.find((i) => i.turnMonth === month)?.memberName;
    const monthPayments = kametiData.payments[month];

    let paidList = [];
    let pendingList = [];

    Object.entries(monthPayments).forEach(([name, data]) => {
      if (data.status) paidList.push(`${name} (${data.mode})`);
      else pendingList.push(name);
    });

    let msg = `📢 *${kametiData.name} - Month ${month} Update*\n`;
    msg += `🎁 *Iss Mahine Ki Kameti:* *${winner}*\n`;
    msg += `💰 Payout Amount: ₹${kametiData.totalPool}\n\n`;

    msg += `✅ *Paid (${paidList.length}/${kametiData.lineup.length}):*\n`;
    paidList.forEach((n) => (msg += `• ${n}\n`));

    msg += `\n❌ *Pending (${pendingList.length}):*\n`;
    pendingList.forEach((n) => (msg += `• ${n}\n`));

    if (kametiData.adminUpi && pendingList.length > 0) {
      msg += `\n📲 *Pay via UPI ID:* ${kametiData.adminUpi}`;
    }

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // WhatsApp: Individual Reminder / Receipt
  const sendPersonalWhatsApp = (member, month, isPaid) => {
    let msg = "";
    if (isPaid) {
      msg = `✅ *Payment Receipt - ${kametiData.name}*\n\nNamaste ${member},\nAapki Month ${month} ki kisht (₹${kametiData.amount}) prapt ho gayi hai. Dhanyawad!`;
    } else {
      msg = `⚠️ *Kisht Reminder - ${kametiData.name}*\n\nNamaste ${member},\nAapki Month ${month} ki kameti kisht (₹${kametiData.amount}) abhi pending hai.\n`;
      if (kametiData.adminUpi) {
        msg += `Aap is UPI ID par pay kar sakte hain: *${kametiData.adminUpi}*\n`;
        msg += `Direct Pay Link: upi://pay?pa=${kametiData.adminUpi}&pn=${encodeURIComponent(kametiData.name)}&am=${kametiData.amount}&cu=INR`;
      }
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Data Export (Backup)
  const exportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(kametiData));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${kametiData.name.replace(/\s+/g, "_")}_backup.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Data Import (Restore)
  const importBackup = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.lineup && parsed.payments) {
          setKametiData(parsed);
          alert("Backup successfully restore ho gaya!");
        } else {
          alert("Galat backup file hai!");
        }
      } catch (err) {
        alert("File read karne me error aayi!");
      }
    };
  };

  // Calculate Month Collection Stats
  const currentMonthData = kametiData?.payments[kametiData?.currentMonth] || {};
  const paidCount = Object.values(currentMonthData).filter((p) => p.status).length;
  const totalCount = kametiData?.lineup?.length || 0;
  const collectedAmount = paidCount * (kametiData?.amount || 0);

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-5 max-w-xl mx-auto font-sans text-slate-800 pb-16">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-black text-indigo-700 tracking-tight">🏦 Kameti Pro</h1>
          <p className="text-xs text-slate-500 font-medium">Chit Fund & Lucky Draw Manager</p>
        </div>
        {kametiData && (
          <div className="flex gap-2">
            <button
              onClick={exportBackup}
              title="Backup Download"
              className="bg-white border text-xs px-2.5 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-slate-50"
            >
              💾 Backup
            </button>
            <button
              onClick={() => {
                if (confirm("Reset karne par current data remove ho jayega. Pehle backup le lein agar zaroorat ho. Sure hain?")) {
                  localStorage.removeItem("kameti_app_pro_data");
                  setKametiData(null);
                }
              }}
              className="bg-red-50 text-red-600 text-xs px-2.5 py-1.5 rounded-lg font-semibold hover:bg-red-100"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Form: Start New Kameti */}
      {!kametiData ? (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b pb-2">Nayi Kameti Setup Karein</h2>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kameti Ka Naam</label>
            <input
              type="text"
              placeholder="e.g. Market Friends 50k"
              className="w-full border border-slate-300 p-2.5 rounded-xl mt-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={kametiName}
              onChange={(e) => setKametiName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Monthly Kisht (₹)</label>
              <input
                type="number"
                placeholder="e.g. 5000"
                className="w-full border border-slate-300 p-2.5 rounded-xl mt-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">UPI ID (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 9876543210@paytm"
                className="w-full border border-slate-300 p-2.5 rounded-xl mt-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={adminUpi}
                onChange={(e) => setAdminUpi(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Members (Har line me ek naam likhein)
            </label>
            <textarea
              rows="5"
              placeholder="Ramesh Sharma&#10;Gurpreet Singh&#10;Mohit Verma&#10;Jaswinder Singh"
              className="w-full border border-slate-300 p-2.5 rounded-xl mt-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
            />
          </div>

          <button
            onClick={startNewKameti}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-md transition-all active:scale-[0.99]"
          >
            🎲 Auto Lucky Draw & Shuru Karein
          </button>

          <div className="pt-2 border-t text-center">
            <input type="file" ref={fileInputRef} onChange={importBackup} accept=".json" className="hidden" />
            <button
              onClick={() => fileInputRef.current.click()}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Purana Backup (.json) Restore Karein
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top Info Card */}
          <div className="bg-indigo-700 text-white p-4 rounded-2xl shadow-md">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-black">{kametiData.name}</h2>
                <p className="text-xs text-indigo-200 mt-0.5">
                  ₹{kametiData.amount} / member • {kametiData.lineup.length} Mahine
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-indigo-200">Total Pool</span>
                <p className="text-xl font-black">₹{kametiData.totalPool.toLocaleString("en-IN")}</p>
              </div>
            </div>

            {/* Progress Bar for Current Month */}
            <div className="mt-4 pt-3 border-t border-indigo-600/50">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Month {kametiData.currentMonth} Collection:</span>
                <span>₹{collectedAmount.toLocaleString("en-IN")} / ₹{kametiData.totalPool.toLocaleString("en-IN")}</span>
              </div>
              <div className="w-full bg-indigo-950/40 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-400 h-2 transition-all duration-300"
                  style={{ width: `${(paidCount / totalCount) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Month Selector Carousel */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {kametiData.lineup.map((item) => {
              const mPaid = Object.values(kametiData.payments[item.turnMonth] || {}).filter((p) => p.status).length;
              const isAllPaid = mPaid === totalCount;
              return (
                <button
                  key={item.turnMonth}
                  onClick={() => setKametiData({ ...kametiData, currentMonth: item.turnMonth })}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    kametiData.currentMonth === item.turnMonth
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  Month {item.turnMonth} {isAllPaid ? "✓" : `(${mPaid}/${totalCount})`}
                </button>
              );
            })}
          </div>

          {/* Current Month Active Panel */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                  Iss Mahine Ka Winner
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  🎁 {kametiData.lineup.find((i) => i.turnMonth === kametiData.currentMonth)?.memberName}
                </h3>
              </div>
              <button
                onClick={() => sendMonthStatusToWhatsApp(kametiData.currentMonth)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm"
              >
                📲 WhatsApp Status
              </button>
            </div>

            {/* Members Collection Checklist */}
            <div className="divide-y divide-slate-100">
              {Object.entries(kametiData.payments[kametiData.currentMonth]).map(([member, pay]) => (
                <div key={member} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{member}</p>
                    <div className="flex gap-2 text-[11px] text-slate-500 items-center mt-0.5">
                      <span>{pay.status ? `Paid on ${pay.date}` : "Pending"}</span>
                      {pay.status && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium border text-slate-600">
                          {pay.mode}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions for this member */}
                  <div className="flex items-center gap-1.5">
                    {/* Mode Toggle Button (Cash / Online) */}
                    {pay.status ? (
                      <button
                        onClick={() =>
                          updatePaymentStatus(
                            kametiData.currentMonth,
                            member,
                            true,
                            pay.mode === "Cash" ? "UPI" : "Cash"
                          )
                        }
                        className="text-[11px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-semibold border"
                        title="Click to toggle Cash / UPI"
                      >
                        {pay.mode}
                      </button>
                    ) : null}

                    {/* Paid / Pending Toggle */}
                    <button
                      onClick={() => updatePaymentStatus(kametiData.currentMonth, member, !pay.status, pay.mode)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                        pay.status
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}
                    >
                      {pay.status ? "Paid ✓" : "Pending"}
                    </button>

                    {/* Individual WhatsApp reminder/receipt */}
                    <button
                      onClick={() => sendPersonalWhatsApp(member, kametiData.currentMonth, pay.status)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title={pay.status ? "Receipt Bhejo" : "Reminder Bhejo"}
                    >
                      💬
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Lineup Schedule View */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">📅 Full Lucky Draw Lineup</h3>
                <p className="text-[11px] text-slate-500">Auto-generated draw order</p>
              </div>
              <button
                onClick={sendLineupToWhatsApp}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
              >
                Share All
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {kametiData.lineup.map((item) => (
                <div
                  key={item.turnMonth}
                  className={`p-2 rounded-xl flex justify-between items-center border ${
                    item.turnMonth === kametiData.currentMonth
                      ? "bg-indigo-50 border-indigo-200 font-bold"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <span className="text-slate-500">Month {item.turnMonth}</span>
                  <span className="text-slate-900">{item.memberName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
