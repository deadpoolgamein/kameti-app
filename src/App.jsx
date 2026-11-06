import React, { useState, useEffect, useRef } from "react";

// ==========================================
// 🔴 APNI SUPABASE DETAILS VERIFY KAREIN:
const SUPABASE_URL = "https://nbitwmhdcqaqbueeoltv.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_bk9aAGYfb2on1acUR15dCA_87iL-xyM"; 
// ==========================================

export default function App() {
  const isMemberView = new URLSearchParams(window.location.search).get("view") === "member";

  const [kametiName, setKametiName] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [adminUpi, setAdminUpi] = useState("");
  const [dueDay, setDueDay] = useState("10"); // Default day: 10th
  const [startMonthYear, setStartMonthYear] = useState("2026-09"); // CGC 2000 Month 1 was Sept 2026
  const [isExistingKameti, setIsExistingKameti] = useState(true);
  const [currentRunningMonth, setCurrentRunningMonth] = useState("3");
  const [memberSequenceInput, setMemberSequenceInput] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const [receiptModal, setReceiptModal] = useState(null);
  const [generatedImgUrl, setGeneratedImgUrl] = useState(null);
  const fileInputRef = useRef(null);

  const [kametiData, setKametiData] = useState(null);

  const showBanner = (msg) => {
    setSyncMessage(msg);
    setTimeout(() => setSyncMessage(""), 3500);
  };

  // Har month ki dynamic date nikaalne ka function
  const getDynamicDueDate = (turnMonth) => {
    const startStr = kametiData?.startMonthYear || "2026-09";
    const [year, month] = startStr.split("-").map(Number);
    const day = kametiData?.dueDay || "10";

    // turnMonth 1 = September 2026
    const targetDate = new Date(year, month - 1 + (turnMonth - 1), Number(day));
    return targetDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // 1. Cloud load
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
          localStorage.setItem("kameti_app_pro_data", JSON.stringify(data[0].data));
        } else {
          const local = localStorage.getItem("kameti_app_pro_data");
          if (local) setKametiData(JSON.parse(local));
        }
      } catch (err) {
        console.error("Cloud load error:", err);
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

  // 2. Cloud save
  const saveToCloudAndLocal = async (newData, manualTrigger = false) => {
    setKametiData(newData);
    localStorage.setItem("kameti_app_pro_data", JSON.stringify(newData));

    if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR_PROJECT_ID")) {
      if (manualTrigger) showBanner("⚠️ Supabase keys check karein");
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/kameti_data`, {
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

      if (res.ok) {
        if (manualTrigger) showBanner("✅ Cloud par sync ho gaya!");
      } else {
        showBanner("❌ Cloud Save Error");
      }
    } catch (err) {
      showBanner("❌ Network Connection Error");
    } finally {
      setIsSyncing(false);
    }
  };

  // Setup Kameti
  const setupKameti = () => {
    const members = memberSequenceInput
      .split("\n")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    if (!kametiName || !monthlyAmount || members.length < 2) {
      alert("Name, amount aur kam se kam 2 members daalein!");
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
          penalty: 0,
        };
      });
    }

    const newKametiObj = {
      name: kametiName,
      amount: Number(monthlyAmount),
      totalPool: Number(monthlyAmount) * members.length,
      adminUpi: adminUpi.trim(),
      dueDay: dueDay.trim() || "10",
      startMonthYear: startMonthYear || "2026-09",
      lineup,
      payments,
      currentMonth: startMonth,
    };

    saveToCloudAndLocal(newKametiObj, true);
  };

  const updatePaymentStatus = (month, member, status, mode = "Cash") => {
    if (isMemberView) return;
    const currentMemberData = kametiData.payments[month][member] || {};
    const updated = {
      ...kametiData,
      payments: {
        ...kametiData.payments,
        [month]: {
          ...kametiData.payments[month],
          [member]: {
            ...currentMemberData,
            status,
            mode,
            date: status ? new Date().toLocaleDateString("en-IN") : null,
          },
        },
      },
    };
    saveToCloudAndLocal(updated, false);
  };

  // Penalty Toggle (+₹100 Late Fee)
  const togglePenalty = (month, member) => {
    if (isMemberView) return;
    const currentMemberData = kametiData.payments[month][member] || {};
    const newPenalty = currentMemberData.penalty ? 0 : 100;
    const updated = {
      ...kametiData,
      payments: {
        ...kametiData.payments,
        [month]: {
          ...kametiData.payments[month],
          [member]: {
            ...currentMemberData,
            penalty: newPenalty,
          },
        },
      },
    };
    saveToCloudAndLocal(updated, false);
  };

  // Canvas Card Image with Live UPI QR
  const generateSlipImage = (member, month, isPaid, mode, date, penalty = 0) => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 840;
    const ctx = canvas.getContext("2d");
    const currentMonthDueDate = getDynamicDueDate(month);
    const finalAmount = kametiData.amount + penalty;

    // Background
    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, 600, 840);

    // Header Gradient
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
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(kametiData.name.toUpperCase(), 300, 55);

    ctx.font = "bold 20px sans-serif";
    ctx.fillText(isPaid ? "✅ PAYMENT RECEIPT SLIP" : "⚠️ INSTALLMENT DUE NOTICE", 300, 95);

    ctx.font = "14px sans-serif";
    ctx.fillText(`Month ${month} of ${kametiData.lineup.length} | Due: ${currentMonthDueDate}`, 300, 130);

    // White Card
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(40, 180, 520, isPaid ? 430 : 610, 16);
    ctx.fill();
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "left";
    const drawRow = (label, val, y, isBold = false, valColor = "#0F172A") => {
      ctx.fillStyle = "#64748B";
      ctx.font = "15px sans-serif";
      ctx.fillText(label, 65, y);

      ctx.fillStyle = valColor;
      ctx.font = isBold ? "bold 17px sans-serif" : "600 16px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(val, 535, y);
      ctx.textAlign = "left";

      ctx.strokeStyle = "#F1F5F9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(65, y + 12);
      ctx.lineTo(535, y + 12);
      ctx.stroke();
    };

    drawRow("Member Name:", member, 230, true);
    drawRow("Kisht Amount:", `₹${kametiData.amount.toLocaleString("en-IN")}`, 280, true);
    if (penalty > 0) {
      drawRow("Late Fee / Penalty:", `+₹${penalty}`, 330, true, "#DC2626");
      drawRow("Total Payable:", `₹${finalAmount.toLocaleString("en-IN")}`, 380, true, "#1E3A8A");
    }
    const currentOffset = penalty > 0 ? 100 : 0;

    drawRow("Kameti Month:", `Month ${month}`, 330 + currentOffset);
    drawRow("Status:", isPaid ? "PAID / CLEARED" : "PENDING DUE", 380 + currentOffset, true, isPaid ? "#059669" : "#D97706");

    if (isPaid) {
      drawRow("Payment Mode:", mode || "Cash", 430 + currentOffset);
      drawRow("Receipt Date:", date || new Date().toLocaleDateString("en-IN"), 480 + currentOffset);
      ctx.fillStyle = "#94A3B8";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Generated automatically via Kameti Pro Cloud", 300, 680);
      setGeneratedImgUrl(canvas.toDataURL("image/png"));
      setReceiptModal({ member, month, isPaid });
    } else {
      drawRow("Due Date:", currentMonthDueDate, 430 + currentOffset, true, "#B45309");
      drawRow("Pay UPI ID:", kametiData.adminUpi || "Direct Contact Admin", 480 + currentOffset);

      // Draw QR Code on Reminder
      if (kametiData.adminUpi) {
        const upiPayString = `upi://pay?pa=${kametiData.adminUpi}&pn=${encodeURIComponent(kametiData.name)}&am=${finalAmount}&cu=INR`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiPayString)}`;

        const qrImg = new Image();
        qrImg.crossOrigin = "anonymous";
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 220, 540 + currentOffset, 160, 160);
          ctx.fillStyle = "#64748B";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Scan QR to Pay via GPay / PhonePe / Paytm", 300, 725 + currentOffset);
          setGeneratedImgUrl(canvas.toDataURL("image/png"));
          setReceiptModal({ member, month, isPaid });
        };
        qrImg.src = qrUrl;
      } else {
        setGeneratedImgUrl(canvas.toDataURL("image/png"));
        setReceiptModal({ member, month, isPaid });
      }
    }
  };

  const handleShareSlip = async () => {
    if (!generatedImgUrl) return;
    try {
      const res = await fetch(generatedImgUrl);
      const blob = await res.blob();
      const file = new File([blob], `${receiptModal.member}_month_${receiptModal.month}_slip.png`, {
        type: "image/png",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${kametiData.name} Slip`,
          text: `Namaste ${receiptModal.member}, Month ${receiptModal.month} ki kameti slip attach hai.`,
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
    const dueDateFormatted = getDynamicDueDate(month);

    let paidList = [];
    let pendingList = [];

    Object.entries(monthPayments).forEach(([name, data]) => {
      if (data.status) paidList.push(`${name} (${data.mode})`);
      else pendingList.push(data.penalty ? `${name} (Late Fee: +₹${data.penalty})` : name);
    });

    let msg = `📢 *${kametiData.name} - Month ${month} Update*\n`;
    msg += `🎁 *Iss Mahine Ka Payout:* *${winner}*\n`;
    msg += `⏰ *Last Due Date:* *${dueDateFormatted}*\n`;
    msg += `💰 Total Payout: ₹${kametiData.totalPool.toLocaleString("en-IN")}\n\n`;

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
    let msg = `🎉 *${kametiData.name} - Full Schedule* 🎉\n`;
    msg += `💰 Monthly Kisht: ₹${kametiData.amount} | Total Pool: ₹${kametiData.totalPool}\n\n`;
    kametiData.lineup.forEach((item) => {
      const isCur = item.turnMonth === kametiData.currentMonth ? " 👈 (Running Now)" : "";
      const mDate = getDynamicDueDate(item.turnMonth);
      msg += `Month ${item.turnMonth} (${mDate}): *${item.memberName}*${isCur}\n`;
    });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const copyMemberViewLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?view=member`;
    navigator.clipboard.writeText(link);
    showBanner("🔗 Read-Only Member Link Copied!");
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
      {syncMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 animate-bounce">
          {syncMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-indigo-700 tracking-tight">🏦 Kameti Pro</h1>
            {isMemberView ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                👁️ Member View
              </span>
            ) : (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isSyncing ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {isSyncing ? "Syncing..." : "☁️ Cloud Synced"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">Automatic Due Dates & QR Integration</p>
        </div>

        {kametiData && !isMemberView && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => saveToCloudAndLocal(kametiData, true)}
              disabled={isSyncing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold shadow-sm"
              title="Save to Cloud"
            >
              ☁️ Save
            </button>
            <button
              onClick={copyMemberViewLink}
              className="bg-white border text-xs px-2.5 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-slate-50"
              title="Copy Member Link"
            >
              🔗 Share
            </button>
          </div>
        )}
      </div>

      {!kametiData ? (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b pb-2">Kameti Setup</h2>

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
              🎲 Nayi Kameti
            </button>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">Kameti Name</label>
            <input
              type="text"
              placeholder="e.g. CGC 2000 Kameti"
              className="w-full border p-2.5 rounded-xl mt-1 text-sm outline-none"
              value={kametiName}
              onChange={(e) => setKametiName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Monthly Kisht (₹)</label>
              <input
                type="number"
                placeholder="2000"
                className="w-full border p-2.5 rounded-xl mt-1 text-sm outline-none"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Har Mahine Ki Tareekh</label>
              <input
                type="number"
                placeholder="10"
                className="w-full border p-2.5 rounded-xl mt-1 text-sm outline-none"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">Start Month (Month 1)</label>
              <input
                type="month"
                className="w-full border p-2 rounded-xl mt-1 text-sm outline-none font-semibold text-slate-700"
                value={startMonthYear}
                onChange={(e) => setStartMonthYear(e.target.value)}
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
            <label className="text-xs font-bold text-slate-600 uppercase">Admin UPI ID (QR ke liye)</label>
            <input
              type="text"
              placeholder="e.g. mobile@upi"
              className="w-full border p-2.5 rounded-xl mt-1 text-sm outline-none"
              value={adminUpi}
              onChange={(e) => setAdminUpi(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">
              {isExistingKameti
                ? "Members Lineup (Line 1 = Month 1, Line 2 = Month 2, Line 3 = Month 3 Payout)"
                : "Members (Har line me ek naam)"}
            </label>
            <textarea
              rows="6"
              placeholder="1st Winner Name&#10;2nd Winner Name&#10;3rd Winner Name&#10;4th Member"
              className="w-full border p-2.5 rounded-xl mt-1 text-sm font-mono outline-none"
              value={memberSequenceInput}
              onChange={(e) => setMemberSequenceInput(e.target.value)}
            />
          </div>

          <button
            onClick={setupKameti}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-md"
          >
            {isExistingKameti ? "🚀 Load & Save to Cloud" : "🎲 Draw & Save"}
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
                  ₹{kametiData.amount} / member • Har mahine ki {kametiData.dueDay} tareekh
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-indigo-200">Total Pool</span>
                <p className="text-xl font-black">₹{kametiData.totalPool.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-indigo-600/50">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Month {kametiData.currentMonth} ({getDynamicDueDate(kametiData.currentMonth)}):</span>
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

          {/* Month Switcher Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {kametiData.lineup.map((item) => {
              const mPaid = Object.values(kametiData.payments[item.turnMonth] || {}).filter((p) => p.status).length;
              const mDate = getDynamicDueDate(item.turnMonth);
              return (
                <button
                  key={item.turnMonth}
                  onClick={() => {
                    const updated = { ...kametiData, currentMonth: item.turnMonth };
                    saveToCloudAndLocal(updated, false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all text-left ${
                    kametiData.currentMonth === item.turnMonth
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  <div>Month {item.turnMonth} ({mPaid}/{totalCount})</div>
                  <div className={`text-[10px] ${kametiData.currentMonth === item.turnMonth ? "text-slate-300" : "text-slate-400"}`}>
                    {mDate}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Month Panel */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                  Payout for {getDynamicDueDate(kametiData.currentMonth)}
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
                      {pay.penalty > 0 && (
                        <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-200">
                          Late: +₹{pay.penalty}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isMemberView && (
                      <>
                        {/* Penalty Toggle */}
                        {!pay.status && (
                          <button
                            onClick={() => togglePenalty(kametiData.currentMonth, member)}
                            className={`text-[11px] px-2 py-1 rounded font-bold border ${
                              pay.penalty > 0 ? "bg-red-600 text-white border-red-600" : "bg-slate-50 text-slate-500"
                            }`}
                            title="Toggle ₹100 Late Fee"
                          >
                            +₹100
                          </button>
                        )}

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
                      </>
                    )}

                    <button
                      onClick={() =>
                        generateSlipImage(
                          member,
                          kametiData.currentMonth,
                          pay.status,
                          pay.mode,
                          pay.date,
                          pay.penalty || 0
                        )
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

          {/* Full Schedule */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">📅 Monthly Sequence & Due Dates</h3>
                <p className="text-[11px] text-slate-500">Auto-calculated schedule</p>
              </div>
              <button
                onClick={sendLineupToWhatsApp}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
              >
                Share Schedule
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
                  <div>
                    <span className="text-slate-500">Month {item.turnMonth}</span>
                    <span className="text-[10px] text-slate-400 block">{getDynamicDueDate(item.turnMonth)}</span>
                  </div>
                  <span className="text-slate-900">
                    {item.memberName} {item.turnMonth === kametiData.currentMonth && "👈 (Current)"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Slip Popup Modal */}
      {receiptModal && generatedImgUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-bold text-slate-900 text-sm">
                {receiptModal.isPaid ? "✅ Official Receipt" : "⚠️ Payment Slip with QR"}
              </h4>
              <button onClick={() => setReceiptModal(null)} className="text-slate-400 font-bold">
                ✕
              </button>
            </div>
            <div className="border rounded-xl overflow-hidden bg-slate-50 max-h-[70vh] overflow-y-auto">
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
