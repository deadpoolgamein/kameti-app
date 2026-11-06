import React, { useState, useEffect, useRef } from "react";

export default function App() {
  const [kametiName, setKametiName] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [adminUpi, setAdminUpi] = useState("");
  const [isExistingKameti, setIsExistingKameti] = useState(true); // Default true for running kameti
  const [currentRunningMonth, setCurrentRunningMonth] = useState("3");
  const [dueDate, setDueDate] = useState("10 Nov");
  const [memberSequenceInput, setMemberSequenceInput] = useState("");
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

  // Kameti Setup (New Random OR Already Running Sequence)
  const setupKameti = () => {
    const members = memberSequenceInput
      .split("\n")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    if (!kametiName || !monthlyAmount || members.length < 2) {
      alert("Kameti name, monthly amount aur kam se kam 2 members daalein!");
      return;
    }

    let lineupOrder = [...members];

    // Agar nayi kameti hai to random shuffle karega, ongoing hai to aapke dale huye order me rakhega
    if (!isExistingKameti) {
      for (let i = lineupOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lineupOrder[i], lineupOrder[j]] = [lineupOrder[j], lineupOrder[i]];
      }
    }

    const lineup = lineupOrder.map((name, index) => ({
      turnMonth: index + 1,
      memberName: name,
    }));

    const startMonth = isExistingKameti ? Math.min(Number(currentRunningMonth), lineup.length) : 1;

    // Payments setup
    const payments = {};
    for (let m = 1; m <= lineup.length; m++) {
      payments[m] = {};
      members.forEach((mem) => {
        // Agar running kameti hai aur purana month hai to automatically Paid mark kar dega
        const isPastMonth = isExistingKameti && m < startMonth;
        payments[m][mem] = {
          status: isPastMonth,
          mode: "Cash",
          date: isPastMonth ? "Past Record" : null,
        };
      });
    }

    setKametiData({
      name: kametiName,
      amount: Number(monthlyAmount),
      totalPool: Number(monthlyAmount) * members.length,
      adminUpi: adminUpi.trim(),
      dueDate: dueDate.trim() || "10th of every month",
      lineup,
      payments,
      currentMonth: startMonth,
    });
  };

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
    let msg = `🎉 *${kametiData.name} - Lineup & Schedule* 🎉\n`;
    msg += `💰 Kisht: ₹${kametiData.amount} | Pool: ₹${kametiData.totalPool}\n`;
    msg += `📅 Due Date: *Har mahine ki ${kametiData.dueDate}*\n`;
    if (kametiData.adminUpi) msg += `📲 UPI: ${kametiData.adminUpi}\n`;
    msg += `\n*Lineup Order:*\n`;
    kametiData.lineup.forEach((item) => {
      const isCurrent = item.turnMonth === kametiData.currentMonth ? " 👈 (Running Now)" : "";
      msg += `Month ${item.turnMonth}: *${item.memberName}*${isCurrent}\n`;
    });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // WhatsApp: Monthly Status (10 Nov Payout Special)
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
    msg += `🎁 *Iss Mahine Ka Payout:* *${winner}*\n`;
    msg += `⏰ *Last Date:* *${kametiData.dueDate}*\n`;
    msg += `💰 Total Payout: ₹${kametiData.totalPool}\n\n`;

    msg += `✅ *Paid (${paidList.length}/${kametiData.lineup.length}):*\n`;
    paidList.forEach((n) => (msg += `• ${n}\n`));

    msg += `\n❌ *Pending (${pendingList.length}):*\n`;
    pendingList.forEach((n) => (msg += `• ${n}\n`));

    if (kametiData.adminUpi && pendingList.length > 0) {
      msg += `\n📲 *Pay via UPI:* ${kametiData.adminUpi}`;
    }

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // WhatsApp: Personal Reminder
  const sendPersonalWhatsApp = (member, month, isPaid) => {
    let msg = "";
    if (isPaid) {
      msg = `✅ *Receipt - ${kametiData.name}*\n\nNamaste ${member},\nAapki Month ${month} ki kisht (₹${kametiData.amount}) prapt ho chuki hai. Dhanyawad!`;
    } else {
      msg = `⚠️ *Kisht Reminder - ${kametiData.name}*\n\nNamaste ${member},\nAapki Month ${month} ki kisht (₹${kametiData.amount}) abhi pending hai.\n`;
      msg += `⏰ *Last Date:* *${kametiData.dueDate}*\n`;
      if (kametiData.adminUpi) {
        msg += `📲 UPI ID: *${kametiData.adminUpi}*\n`;
        msg += `Pay Link: upi://pay?pa=${kametiData.adminUpi}&pn=${encodeURIComponent(kametiData.name)}&am=${kametiData.amount}&cu=INR`;
      }
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const exportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(kametiData));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `${kametiData.name.replace(/\s+/g, "_")}_backup.json`;
    a.click();
  };

  const importBackup = (e) => {
    const reader = new FileReader();
    reader.readAsText(e.target.files[0], "UTF-8");
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.lineup && parsed.payments) {
          setKametiData(parsed);
          alert("Backup restore ho gaya!");
        }
      } catch (err) {
        alert("Error in file!");
      }
    };
  };

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
          <p className="text-xs text-slate-500 font-medium">Chit Fund & Payout Manager</p>
        </div>
        {kametiData && (
          <div className="flex gap-2">
            <button onClick={exportBackup} className="bg-white border text-xs px-2.5 py-1.5 rounded-lg shadow-sm font-semibold">
              💾 Backup
            </button>
            <button
              onClick={() => {
                if (confirm("Reset karne par data clear ho jayega. Sure hain?")) {
                  localStorage.removeItem("kameti_app_pro_data");
                  setKametiData(null);
                }
              }}
              className="bg-red-50 text-red-600 text-xs px-2.5 py-1.5 rounded-lg font-semibold"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {!kametiData ? (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b pb-2">Kameti Entry Karein</h2>

          {/* Toggle: Already running vs Fresh new */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setIsExistingKameti(true)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                isExistingKameti ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
              }`}
            >
              ⚡ Pehle Se Chal Rahi Hai
            </button>
            <button
              onClick={() => setIsExistingKameti(false)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                !isExistingKameti ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
              }`}
            >
              🎲 Bilkul Fresh (Draw Nikaalna Hai)
            </button>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">Kameti Name</label>
            <input
              type="text"
              placeholder="e.g. 50k Wali Kameti"
              className="w-full border p-2.5 rounded-xl mt-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={kametiName}
              onChange={(e) => setKametiName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Monthly Kisht (₹)</label>
              <input
                type="number"
                placeholder="e.g. 5000"
                className="w-full border p-2.5 rounded-xl mt-1 text-sm outline-none"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Payout / Due Date</label>
              <input
                type="text"
                placeholder="e.g. 10 Nov"
                className="w-full border p-2.5 rounded-xl mt-1 text-sm outline-none"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Admin UPI ID</label>
              <input
                type="text"
                placeholder="e.g. mobile@upi"
                className="w-full border p-2.5 rounded-xl mt-1 text-sm outline-none"
                value={adminUpi}
                onChange={(e) => setAdminUpi(e.target.value)}
              />
            </div>
            {isExistingKameti && (
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Abhi Konsa Month Hai?</label>
                <input
                  type="number"
                  placeholder="3"
                  className="w-full border p-2.5 rounded-xl mt-1 text-sm font-bold text-indigo-700 outline-none"
                  value={currentRunningMonth}
                  onChange={(e) => setCurrentRunningMonth(e.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">
              {isExistingKameti
                ? "Members Sequence Me Daalein (1st line = Month 1 Winner, 2nd line = Month 2, 3rd = Month 3)"
                : "Members (Har line me ek naam)"}
            </label>
            <textarea
              rows="6"
              placeholder={`1st Winner Name\n2nd Winner Name\n3rd Winner (10 Nov Payout)\n4th Member\n5th Member`}
              className="w-full border p-2.5 rounded-xl mt-1 text-sm font-mono outline-none"
              value={memberSequenceInput}
              onChange={(e) => setMemberSequenceInput(e.target.value)}
            />
            {isExistingKameti && (
              <p className="text-[11px] text-amber-600 mt-1 font-medium">
                💡 Tip: Jiska pehle payout ho chuka hai unka naam pehle daalein, 3rd line par 10 Nov wale ka naam daalein.
              </p>
            )}
          </div>

          <button
            onClick={setupKameti}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-md"
          >
            {isExistingKameti ? "🚀 Load Running Kameti (Month 3)" : "🎲 Draw & Start"}
          </button>

          <div className="pt-2 border-t text-center">
            <input type="file" ref={fileInputRef} onChange={importBackup} accept=".json" className="hidden" />
            <button onClick={() => fileInputRef.current.click()} className="text-xs text-indigo-600 font-semibold">
              Purana Backup (.json) Restore Karein
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="bg-indigo-700 text-white p-4 rounded-2xl shadow-md">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-black">{kametiData.name}</h2>
                <p className="text-xs text-indigo-200 mt-0.5">
                  ₹{kametiData.amount} / member • Last Date: {kametiData.dueDate}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-indigo-200">Total Pool</span>
                <p className="text-xl font-black">₹{kametiData.totalPool.toLocaleString("en-IN")}</p>
              </div>
            </div>

            {/* Collection Progress */}
            <div className="mt-4 pt-3 border-t border-indigo-600/50">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Month {kametiData.currentMonth} Collected:</span>
                <span>
                  ₹{collectedAmount.toLocaleString("en-IN")} / ₹{kametiData.totalPool.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="w-full bg-indigo-950/40 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-400 h-2 transition-all duration-300"
                  style={{ width: `${(paidCount / totalCount) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Month Switcher */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {kametiData.lineup.map((item) => {
              const mPaid = Object.values(kametiData.payments[item.turnMonth] || {}).filter((p) => p.status).length;
              return (
                <button
                  key={item.turnMonth}
                  onClick={() => setKametiData({ ...kametiData, currentMonth: item.turnMonth })}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                    kametiData.currentMonth === item.turnMonth
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  Month {item.turnMonth} ({mPaid}/{totalCount})
                </button>
              );
            })}
          </div>

          {/* Current Month Active Panel */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                  Month {kametiData.currentMonth} Payout
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  🎁 {kametiData.lineup.find((i) => i.turnMonth === kametiData.currentMonth)?.memberName}
                </h3>
              </div>
              <button
                onClick={() => sendMonthStatusToWhatsApp(kametiData.currentMonth)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm"
              >
                📲 Group Update
              </button>
            </div>

            {/* Checklist */}
            <div className="divide-y divide-slate-100">
              {Object.entries(kametiData.payments[kametiData.currentMonth]).map(([member, pay]) => (
                <div key={member} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{member}</p>
                    <div className="flex gap-2 text-[11px] text-slate-500 items-center mt-0.5">
                      <span>{pay.status ? `Paid (${pay.date || "Done"})` : "Pending"}</span>
                      {pay.status && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium border text-slate-600">
                          {pay.mode}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {pay.status && (
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
                      >
                        {pay.mode}
                      </button>
                    )}

                    <button
                      onClick={() => updatePaymentStatus(kametiData.currentMonth, member, !pay.status, pay.mode)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold ${
                        pay.status
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}
                    >
                      {pay.status ? "Paid ✓" : "Pending"}
                    </button>

                    <button
                      onClick={() => sendPersonalWhatsApp(member, kametiData.currentMonth, pay.status)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg"
                      title="Send WhatsApp"
                    >
                      💬
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Lineup */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">📅 Full Sequence</h3>
                <p className="text-[11px] text-slate-500">Kiski kameti kis mahine aayegi</p>
              </div>
              <button
                onClick={sendLineupToWhatsApp}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
              >
                Share Full Lineup
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
                  <span className="text-slate-900">
                    {item.memberName} {item.turnMonth === kametiData.currentMonth && "👈 (Current)"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
