import React, { useState, useEffect, useRef } from "react";

// ==========================================
// 🔴 APNI SUPABASE DETAILS YAHAN PASTE KAREIN:
const SUPABASE_URL = "https://nbitwmhdcqaqbueeoltv.supabase.co"; // Step 3 se Project URL
const SUPABASE_KEY = "sb_publishable_bk9aAGYfb2on1acUR15dCA_87iL-xyM"; // Step 3 se anon key
// ==========================================

export default function App() {
  const [kametiName, setKametiName] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [adminUpi, setAdminUpi] = useState("");
  const [isExistingKameti, setIsExistingKameti] = useState(true);
  const [currentRunningMonth, setCurrentRunningMonth] = useState("3");
  const [dueDate, setDueDate] = useState("10 Nov");
  const [memberSequenceInput, setMemberSequenceInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [receiptModal, setReceiptModal] = useState(null);
  const [generatedImgUrl, setGeneratedImgUrl] = useState(null);
  const fileInputRef = useRef(null);

  const [kametiData, setKametiData] = useState(null);

  // 1. App open hone par Supabase Cloud se data load karna
  useEffect(() => {
    async function loadFromCloud() {
      setIsLoading(true);
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/kameti_data?id=eq.active_kameti&select=*`, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        });
        const data = await res.json();
        if (data && data.length > 0 && data[0].data) {
          setKametiData(data[0].data);
        } else {
          // Fallback to local storage if cloud is blank
          const local = localStorage.getItem("kameti_app_pro_data");
          if (local) setKametiData(JSON.parse(local));
        }
      } catch (err) {
        console.error("Cloud load error, using local data", err);
        const local = localStorage.getItem("kameti_app_pro_data");
        if (local) setKametiData(JSON.parse(local));
      } finally {
        setIsLoading(false);
      }
    }

    if (SUPABASE_URL && !SUPABASE_URL.includes("YOUR_PROJECT_ID")) {
      loadFromCloud();
    } else {
      const local = localStorage.getItem("kameti_app_pro_data");
      if (local) setKametiData(JSON.parse(local));
      setIsLoading(false);
    }
  }, []);

  // 2. Koi bhi change hote hi Cloud Database me auto-save hona
  const saveToCloudAndLocal = async (newData) => {
    setKametiData(newData);
    localStorage.setItem("kameti_app_pro_data", JSON.stringify(newData));

    if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR_PROJECT_ID")) return;

    setIsSyncing(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/kameti_data`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          id: "active_kameti",
          data: newData,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("Cloud sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Kameti Setup
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

    const payments = {};
    for (let m = 1; m <= lineup.length; m++) {
      payments[m] = {};
      members.forEach((mem) => {
        const isPastMonth = isExistingKameti && m < startMonth;
        payments[m][mem] = {
          status: isPastMonth,
          mode: "Cash",
          date: isPastMonth ? "Past Record" : null,
        };
      });
    }

    const newKametiObj = {
      name: kametiName,
      amount: Number(monthlyAmount),
      totalPool: Number(monthlyAmount) * members.length,
      adminUpi: adminUpi.trim(),
      dueDate: dueDate.trim() || "10th of every month",
      lineup,
      payments,
      currentMonth: startMonth,
    };

    saveToCloudAndLocal(newKametiObj);
  };

  const updatePaymentStatus = (month, member, status, mode = "Cash") => {
    const updated = {
      ...kametiData,
      payments: {
        ...kametiData.payments,
        [month]: {
          ...kametiData.payments[month],
          [member]: {
            status,
            mode,
            date: status ? new Date().toLocaleDateString("en-IN") : null,
          },
        },
      },
    };
    saveToCloudAndLocal(updated);
  };

  // Reset Cloud and Local
  const handleReset = async () => {
    if (confirm("Reset karne par cloud aur local dono jagah se data delete ho jayega. Sure hain?")) {
      localStorage.removeItem("kameti_app_pro_data");
      setKametiData(null);
      if (SUPABASE_URL && !SUPABASE_URL.includes("YOUR_PROJECT_ID")) {
        await fetch(`${SUPABASE_URL}/rest/v1/kameti_data?id=eq.active_kameti`, {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        });
      }
    }
  };

  // Canvas Receipt Generator
  const generateSlipImage = (member, month, isPaid, mode, date) => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 750;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, 600, 750);

    const headerGrad = ctx.createLinearGradient(0, 0, 600, 0);
    if (isPaid) {
      headerGrad.addColorStop(0, "#059669");
      headerGrad.addColorStop(1, "#10B981");
    } else {
      headerGrad.addColorStop(0, "#D97706");
      headerGrad.addColorStop(1, "#F59E0B");
    }
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, 600, 160);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(kametiData.name.toUpperCase(), 300, 60);

    ctx.font = "bold 20px sans-serif";
    ctx.fillText(isPaid ? "✅ OFFICIAL PAYMENT RECEIPT" : "⚠️ KIST DUE REMINDER SLIP", 300, 105);

    ctx.font = "14px sans-serif";
    ctx.fillText(`Month ${month} of ${kametiData.lineup.length} | Due: ${kametiData.dueDate}`, 300, 135);

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(40, 190, 520, 420, 16);
    ctx.fill();
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "left";
    const drawRow = (label, val, y, isBold = false) => {
      ctx.fillStyle = "#64748B";
      ctx.font = "16px sans-serif";
      ctx.fillText(label, 70, y);

      ctx.fillStyle = "#0F172A";
      ctx.font = isBold ? "bold 18px sans-serif" : "600 17px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(val, 530, y);
      ctx.textAlign = "left";

      ctx.strokeStyle = "#F1F5F9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(70, y + 15);
      ctx.lineTo(530, y + 15);
      ctx.stroke();
    };

    drawRow("Member Name:", member, 250, true);
    drawRow("Installment Amount:", `₹${kametiData.amount.toLocaleString("en-IN")}`, 310, true);
    drawRow("Kameti Month:", `Month ${month}`, 370);
    drawRow("Status:", isPaid ? "PAID / CLEARED" : "PENDING DUE", 430, true);

    if (isPaid) {
      drawRow("Payment Mode:", mode || "Cash", 490);
      drawRow("Receipt Date:", date || new Date().toLocaleDateString("en-IN"), 550);
    } else {
      drawRow("Last Date:", kametiData.dueDate, 490, true);
      drawRow("UPI ID:", kametiData.adminUpi || "Direct Contact Admin", 550);
    }

    ctx.fillStyle = "#94A3B8";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Generated automatically via Kameti Pro Cloud App", 300, 660);

    const imgData = canvas.toDataURL("image/png");
    setGeneratedImgUrl(imgData);
    setReceiptModal({ member, month, isPaid, mode, date });
  };

  const handleShareSlip = async () => {
    if (!generatedImgUrl) return;
    try {
      const res = await fetch(generatedImgUrl);
      const blob = await res.blob();
      const file = new File([blob], `${receiptModal.member}_slip.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${kametiData.name} Slip`,
          text: receiptModal.isPaid
            ? `Namaste ${receiptModal.member}, Month ${receiptModal.month} ki payment receipt attach hai.`
            : `Namaste ${receiptModal.member}, Month ${receiptModal.month} ki kameti installment due slip hai. Last date: ${kametiData.dueDate}.`,
        });
      } else {
        const link = document.createElement("a");
        link.href = generatedImgUrl;
        link.download = `${receiptModal.member}_slip.png`;
        link.click();
      }
    } catch (e) {
      const link = document.createElement("a");
      link.href = generatedImgUrl;
      link.download = `${receiptModal.member}_slip.png`;
      link.click();
    }
  };

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

  const sendLineupToWhatsApp = () => {
    let msg = `🎉 *${kametiData.name} - Full Lineup* 🎉\n`;
    msg += `💰 Kisht: ₹${kametiData.amount} | Pool: ₹${kametiData.totalPool}\n`;
    msg += `📅 Due Date: *Har mahine ki ${kametiData.dueDate}*\n\n`;
    kametiData.lineup.forEach((item) => {
      const isCur = item.turnMonth === kametiData.currentMonth ? " 👈 (Running Now)" : "";
      msg += `Month ${item.turnMonth}: *${item.memberName}*${isCur}\n`;
    });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const currentMonthData = kametiData?.payments[kametiData?.currentMonth] || {};
  const paidCount = Object.values(currentMonthData).filter((p) => p.status).length;
  const totalCount = kametiData?.lineup?.length || 0;
  const collectedAmount = paidCount * (kametiData?.amount || 0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 font-sans">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-bold text-slate-600">Cloud Data Load Ho Raha Hai...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-5 max-w-xl mx-auto font-sans text-slate-800 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-indigo-700 tracking-tight">🏦 Kameti Pro</h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isSyncing ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isSyncing ? "Syncing..." : "☁️ Cloud Saved"}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">Auto-synced with Cloud Database</p>
        </div>
        {kametiData && (
          <button onClick={handleReset} className="bg-red-50 text-red-600 text-xs px-2.5 py-1.5 rounded-lg font-semibold">
            Reset
          </button>
        )}
      </div>

      {!kametiData ? (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b pb-2">Kameti Entry Karein</h2>

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
                ? "Members Sequence Me Daalein (Line 1 = Month 1, Line 2 = Month 2, Line 3 = 10 Nov Payout)"
                : "Members (Har line me ek naam)"}
            </label>
            <textarea
              rows="6"
              placeholder={`1st Winner Name\n2nd Winner Name\n3rd Winner (10 Nov Payout)\n4th Member\n5th Member`}
              className="w-full border p-2.5 rounded-xl mt-1 text-sm font-mono outline-none"
              value={memberSequenceInput}
              onChange={(e) => setMemberSequenceInput(e.target.value)}
            />
          </div>

          <button
            onClick={setupKameti}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-md"
          >
            {isExistingKameti ? "🚀 Load & Save to Cloud (Month 3)" : "🎲 Draw & Save"}
          </button>
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
                  onClick={() => {
                    const updated = { ...kametiData, currentMonth: item.turnMonth };
                    saveToCloudAndLocal(updated);
                  }}
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
                      onClick={() =>
                        generateSlipImage(member, kametiData.currentMonth, pay.status, pay.mode, pay.date)
                      }
                      className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-lg border border-indigo-200 flex items-center gap-1 shadow-sm"
                    >
                      🖼️ Slip
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
                <p className="text-[11px] text-slate-500">Draw line order</p>
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

      {/* Slip Modal */}
      {receiptModal && generatedImgUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-bold text-slate-900 text-sm">
                {receiptModal.isPaid ? "✅ Payment Receipt Card" : "⚠️ Payment Due Slip"}
              </h4>
              <button onClick={() => setReceiptModal(null)} className="text-slate-400 font-bold">
                ✕
              </button>
            </div>
            <div className="border rounded-xl overflow-hidden bg-slate-50">
              <img src={generatedImgUrl} alt="Slip" className="w-full h-auto block" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleShareSlip}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                📲 Share to WhatsApp
              </button>
              <a
                href={generatedImgUrl}
                download={`${receiptModal.member}_slip.png`}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 text-center shadow-md"
              >
                ⬇️ Download PNG
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
