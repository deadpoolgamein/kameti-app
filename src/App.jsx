import React, { useState, useEffect } from "react";

export default function App() {
  const [kametiName, setKametiName] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [kametiData, setKametiData] = useState(() => {
    const saved = localStorage.getItem("kameti_app_data");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (kametiData) {
      localStorage.setItem("kameti_app_data", JSON.stringify(kametiData));
    }
  }, [kametiData]);

  const startNewKameti = () => {
    const members = memberInput
      .split("\n")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    if (!kametiName || !monthlyAmount || members.length < 2) {
      alert("Kameti name, amount aur kam se kam 2 members daalein!");
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
        payments[m][mem] = false;
      });
    }

    setKametiData({
      name: kametiName,
      amount: Number(monthlyAmount),
      totalPool: Number(monthlyAmount) * members.length,
      lineup,
      payments,
      currentMonth: 1,
    });
  };

  const togglePayment = (month, member) => {
    setKametiData((prev) => ({
      ...prev,
      payments: {
        ...prev.payments,
        [month]: {
          ...prev.payments[month],
          [member]: !prev.payments[month][member],
        },
      },
    }));
  };

  const sendLineupToWhatsApp = () => {
    let msg = `🎉 *${kametiData.name} - Lucky Draw Schedule* 🎉\n`;
    msg += `💰 Kisht: ₹${kametiData.amount} | Total Pool: ₹${kametiData.totalPool}\n\n`;
    msg += `*Lineup Sequence:*\n`;
    kametiData.lineup.forEach((item) => {
      msg += `Month ${item.turnMonth}: *${item.memberName}*\n`;
    });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const sendMonthStatusToWhatsApp = (month) => {
    const winner = kametiData.lineup.find((item) => item.turnMonth === month)?.memberName;
    const monthPayments = kametiData.payments[month];

    let paidList = [];
    let pendingList = [];

    Object.entries(monthPayments).forEach(([name, status]) => {
      if (status) paidList.push(name);
      else pendingList.push(name);
    });

    let msg = `📢 *${kametiData.name} - Month ${month} Status*\n`;
    msg += `🎁 *Iss Mahine Ki Kameti:* ${winner}\n\n`;
    msg += `✅ *Paid (${paidList.length}):*\n` + paidList.map(n => `• ${n}`).join("\n") + "\n\n";
    msg += `❌ *Pending (${pendingList.length}):*\n` + pendingList.map(n => `• ${n}`).join("\n");

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 max-w-xl mx-auto font-sans">
      <h1 className="text-2xl font-bold text-center text-blue-700 mb-6">🏦 Kameti Manager</h1>

      {!kametiData ? (
        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-lg font-bold text-gray-800">New Kameti Setup</h2>
          <div>
            <label className="text-sm font-semibold text-gray-700">Kameti Name</label>
            <input
              type="text"
              placeholder="e.g. Friends 50k Group"
              className="w-full border p-2.5 rounded mt-1"
              value={kametiName}
              onChange={(e) => setKametiName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Monthly Kisht (₹)</label>
            <input
              type="number"
              placeholder="e.g. 5000"
              className="w-full border p-2.5 rounded mt-1"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Members (Har line me ek naam)</label>
            <textarea
              rows="5"
              placeholder="Rahul&#10;Amit&#10;Pooja&#10;Vikram"
              className="w-full border p-2.5 rounded mt-1"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
            />
          </div>
          <button
            onClick={startNewKameti}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700"
          >
            🎲 Draw Lineup & Start
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-xl shadow flex justify-between items-center">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">{kametiData.name}</h2>
              <p className="text-xs text-gray-500">Kisht: ₹{kametiData.amount} | Pool: ₹{kametiData.totalPool}</p>
            </div>
            <button
              onClick={() => {
                if (confirm("Reset karne se ye kameti delete ho jayegi. Sure hain?")) {
                  localStorage.removeItem("kameti_app_data");
                  setKametiData(null);
                }
              }}
              className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-md font-semibold"
            >
              Reset
            </button>
          </div>

          {/* Lineup Card */}
          <div className="bg-white p-4 rounded-xl shadow">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-700 text-sm">🎯 Lucky Draw Lineup</h3>
              <button
                onClick={sendLineupToWhatsApp}
                className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-md font-semibold hover:bg-green-700"
              >
                Share Lineup
              </button>
            </div>
            <div className="divide-y text-sm">
              {kametiData.lineup.map((item) => (
                <div key={item.turnMonth} className="py-2 flex justify-between">
                  <span className="text-gray-500">Month {item.turnMonth}:</span>
                  <span className="font-bold text-gray-800">{item.memberName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Kisht Tracker */}
          <div className="bg-white p-4 rounded-xl shadow">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold text-gray-700 text-sm">💳 Month {kametiData.currentMonth} Kisht</h3>
                <p className="text-xs text-blue-600 font-semibold">
                  Winner: {kametiData.lineup.find((i) => i.turnMonth === kametiData.currentMonth)?.memberName}
                </p>
              </div>
              <button
                onClick={() => sendMonthStatusToWhatsApp(kametiData.currentMonth)}
                className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-md font-semibold hover:bg-green-700"
              >
                Share Status
              </button>
            </div>

            {/* Month Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {kametiData.lineup.map((item) => (
                <button
                  key={item.turnMonth}
                  onClick={() => setKametiData({ ...kametiData, currentMonth: item.turnMonth })}
                  className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap ${
                    kametiData.currentMonth === item.turnMonth
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  M{item.turnMonth}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {Object.entries(kametiData.payments[kametiData.currentMonth]).map(([member, isPaid]) => (
                <div key={member} className="flex justify-between items-center p-2 rounded bg-gray-50 border">
                  <span className="text-sm font-semibold text-gray-700">{member}</span>
                  <button
                    onClick={() => togglePayment(kametiData.currentMonth, member)}
                    className={`text-xs px-3 py-1 rounded-md font-bold ${
                      isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                    }`}
                  >
                    {isPaid ? "✅ Paid" : "⏳ Pending"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
