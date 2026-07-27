import { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { HDate } from '@hebcal/core';
import ori from './ori.png';

const CATEGORIES = {
  'הלכות שבת': { id: 'shabbat', parts: 2 },
  'הלכות ברכות': { id: 'brachot', parts: 1 },
  'הלכות חנוכה': { id: 'chanukah', parts: 1 },
  'הלכות ימים נוראים': { id: 'yamim_noraim', parts: 1 },
  'הלכות סוכה': { id: 'sukkot', parts: 1 },
  'הלכות פורים': { id: 'purim', parts: 1 },
  'הלכות פסח': { id: 'pesach', parts: 1 },
  'הלכות תעניות': { id: 'taaniyot', parts: 1 }
};

const HebrewUtils = {
  days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],

  gematriyaDay: (day) => {
    if (day === 15) return 'טו';
    if (day === 16) return 'טז';

    const tens = Math.floor(day / 10) * 10;
    const ones = day % 10;

    let hebrewTens = '';
    let hebrewOnes = '';

    switch (tens) {
      case 10: hebrewTens = 'י'; break;
      case 20: hebrewTens = 'כ'; break;
      case 30: hebrewTens = 'ל'; break;
      default: hebrewTens = '';
    }

    switch (ones) {
      case 1: hebrewOnes = 'א'; break;
      case 2: hebrewOnes = 'ב'; break;
      case 3: hebrewOnes = 'ג'; break;
      case 4: hebrewOnes = 'ד'; break;
      case 5: hebrewOnes = 'ה'; break;
      case 6: hebrewOnes = 'ו'; break;
      case 7: hebrewOnes = 'ז'; break;
      case 8: hebrewOnes = 'ח'; break;
      case 9: hebrewOnes = 'ט'; break;
      default: hebrewOnes = '';
    }

    return hebrewTens + hebrewOnes;
  },

  yearToHebrewString: (year) => {
    const hebrewLetters = {
      1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה',
      6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט', 10: 'י',
      15: 'טו', 16: 'טז', 20: 'כ', 30: 'ל', 40: 'מ',
      50: 'נ', 60: 'ס', 70: 'ע', 80: 'פ', 90: 'צ',
      100: 'ק', 200: 'ר', 300: 'ש', 400: 'ת'
    };

    const tens = Math.floor((year % 100) / 10);
    const ones = year % 10;
    const tensLetter = hebrewLetters[tens * 10] || '';
    const onesLetter = hebrewLetters[ones] || '';

    return `ה'תש${tensLetter}${onesLetter}`;
  },

  monthNameToHebrew: (monthName) => {
    const monthMap = {
      Nisan: 'ניסן', Iyyar: 'אייר', Sivan: 'סיון', Tamuz: 'תמוז', Av: 'אב', Elul: 'אלול',
      Tishrei: 'תשרי', Cheshvan: 'חשון', Kislev: 'כסלו', Tevet: 'טבת', "Sh'vat": 'שבט', Adar: 'אדר'
    };
    return monthMap[monthName] || monthName;
  }
};

const calculateFontSize = (texts) => {
  const baseSize = 18;
  const maxLength = Math.max(...texts.map((text) => text.length));
  return maxLength <= 200 ? baseSize : Math.max(16, baseSize - Math.floor((maxLength - 200) / 20));
};

function HalachaStatusGenerator() {
  const [category, setCategory] = useState('הלכות חנוכה');
  const [partNumber, setPartNumber] = useState(1);
  const [halachot, setHalachot] = useState([]);
  const [currentHalachaIndex, setCurrentHalachaIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stepSize, setStepSize] = useState(2);
  const [halachotCount, setHalachotCount] = useState(2);
  const [cardScale, setCardScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      const available = window.innerWidth - 20;
      setCardScale(Math.min(1, available / 420));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const [hebrewDate, setHebrewDate] = useState(() => {
    const hdate = new HDate();
    return {
      dayOfWeek: `יום ${HebrewUtils.days[hdate.getDay()]}`,
      hebrewDate: `${HebrewUtils.gematriyaDay(hdate.getDate())} ${HebrewUtils.monthNameToHebrew(hdate.getMonthName())} ${HebrewUtils.yearToHebrewString(hdate.getFullYear())}`
    };
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const hdate = new HDate();
      setHebrewDate({
        dayOfWeek: `יום ${HebrewUtils.days[hdate.getDay()]}`,
        hebrewDate: `${HebrewUtils.gematriyaDay(hdate.getDate())} ${HebrewUtils.monthNameToHebrew(hdate.getMonthName())} ${HebrewUtils.yearToHebrewString(hdate.getFullYear())}`
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const loadHalachot = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const docRef =
        category === 'הלכות שבת'
          ? doc(db, 'halachot', `${category}_${partNumber}`)
          : doc(db, 'halachot', category);

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const allHalachot = docSnap.data().halachot || [];
        const unreadHalachot = allHalachot.filter((h) => !h.read);

        const collected = unreadHalachot.slice(currentHalachaIndex, currentHalachaIndex + halachotCount);

        if (collected.length === 0) {
          setError('לא נמצאו הלכות בקטגוריה זו');
        } else {
          setHalachot(collected);
        }
      } else {
        setError('לא נמצאו הלכות בקטגוריה זו');
      }
    } catch (err) {
      setError('שגיאה בטעינת ההלכות');
      console.error('Error loading halachot:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (halachaIds) => {
    try {
      const docRef =
        category === 'הלכות שבת'
          ? doc(db, 'halachot', `${category}_${partNumber}`)
          : doc(db, 'halachot', category);

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const allHalachot = docSnap.data().halachot || [];
        const updatedHalachot = allHalachot.map((halacha) =>
          halachaIds.includes(halacha.id)
            ? { ...halacha, read: true }
            : halacha
        );
        await updateDoc(docRef, { halachot: updatedHalachot });
      }
    } catch (err) {
      console.error('שגיאה בעדכון ההלכות:', err);
    }
  };

  const downloadCardAsImage = async () => {
    const html2canvas = (await import('html2canvas')).default;
    const cardElement = document.getElementById('halacha-card');
    if (!cardElement) return;

    const originalTransform = cardElement.style.transform;
    cardElement.style.transform = 'none';

    try {
      const canvas = await html2canvas(cardElement, { useCORS: true, scale: 2 });

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png');
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'halacha.png';
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      cardElement.style.transform = originalTransform;
    }
  };

  const handleDownload = async () => {
    try {
      const halachaIds = halachot.map((halacha) => halacha.id);
      await markAsRead(halachaIds);
      await downloadCardAsImage();
      alert('ההלכות סומנו כנקראו והתמונה הורדה בהצלחה.');
    } catch (error) {
      console.error('שגיאה בהורדה כתמונה:', error);
      alert('אירעה שגיאה בהמרה להורדה כתמונה');
    }
  };

  const handleDownloadOnly = async () => {
    try {
      await downloadCardAsImage();
    } catch (error) {
      console.error('שגיאה בהורדה כתמונה:', error);
      alert('אירעה שגיאה בהמרה להורדה כתמונה');
    }
  };

  const loadNextHalachot = () => {
    setCurrentHalachaIndex((prev) => prev + stepSize);
  };

  const loadPreviousHalachot = () => {
    setCurrentHalachaIndex((prev) => Math.max(prev - stepSize, 0));
  };

  const fontSize = useMemo(() => calculateFontSize(halachot.map((h) => h.text)), [halachot]);

  useEffect(() => {
    loadHalachot();
  }, [category, partNumber, currentHalachaIndex, halachotCount]);

  return (
    <div style={{ padding: '20px', margin: '0 auto', direction: 'rtl' }}>
      <div style={{ marginBottom: '20px' }}>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setCurrentHalachaIndex(0); }} style={{ padding: '8px', marginRight: '10px' }}>
          {Object.keys(CATEGORIES).map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {category === 'הלכות שבת' && (
          <select value={partNumber} onChange={(e) => { setPartNumber(Number(e.target.value)); setCurrentHalachaIndex(0); }} style={{ padding: '8px' }}>
            {[...Array(CATEGORIES[category].parts)].map((_, index) => (
              <option key={index + 1} value={index + 1}>{`חלק ${HebrewUtils.gematriyaDay(index + 1)}`}</option>
            ))}
          </select>
        )}
      </div>

      <div style={{ marginBottom: '10px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
        <span>מספר הלכות להצגה בכרטיס:</span>
        <button onClick={() => setHalachotCount((c) => Math.max(c - 1, 1))} style={{ width: '32px', height: '32px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f5f5f5', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>−</button>
        <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 'bold' }}>{halachotCount}</span>
        <button onClick={() => setHalachotCount((c) => c + 1)} style={{ width: '32px', height: '32px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f5f5f5', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>+</button>
      </div>

      <div style={{ marginBottom: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
        <span>מספר הלכות לקידום או חזרה:</span>
        <button onClick={() => setStepSize((s) => Math.max(s - 1, 1))} style={{ width: '32px', height: '32px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f5f5f5', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>−</button>
        <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 'bold' }}>{stepSize}</span>
        <button onClick={() => setStepSize((s) => s + 1)} style={{ width: '32px', height: '32px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f5f5f5', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>+</button>
      </div>

      <div style={{ width: `${420 * cardScale}px`, height: `${750 * cardScale}px`, margin: '0 auto' }}>
        <div id="halacha-card" style={{ width: '420px', height: '750px', transform: `scale(${cardScale})`, transformOrigin: 'top right', backgroundColor: '#FFEFD5', backgroundRepeat: 'no-repeat', backgroundPosition: 'left  bottom', backgroundSize: '200px', backgroundImage: `url(${ori})`, padding: '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', color: 'black', fontFamily: "'David Libre', serif", boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {isLoading ? (
            <div>טוען הלכות...</div>
          ) : error ? (
            <div style={{ color: 'red' }}>{error}</div>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>{hebrewDate.dayOfWeek}, {hebrewDate.hebrewDate}<br />{category}</h2>
                {halachot.map((halacha) => (
                  <p key={halacha.id} style={{ fontSize: `${fontSize}px`, lineHeight: '1.6', marginBottom: '15px', textAlign: 'justify' }}>{halacha.text}</p>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #ccc', paddingTop: '10px', marginTop: 'auto', textAlign: 'center', fontSize: '28px', fontWeight: 'bold', color: '#c00', letterSpacing: '1px' }}>לעילוי נשמת אורי בן עינב הי"ד</div>
            </>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <button onClick={loadPreviousHalachot} style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} disabled={currentHalachaIndex === 0}>הלכות קודמות</button>
        <button onClick={handleDownload} style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>הורד וסמן כנקרא</button>
        <button onClick={handleDownloadOnly} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>הורד בלבד</button>
        <button onClick={loadNextHalachot} style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>הלכות הבאות</button>
      </div>
    </div>
  );
}

export default HalachaStatusGenerator;
