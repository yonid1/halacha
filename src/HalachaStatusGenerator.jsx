import { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { HDate } from '@hebcal/core';
import ori from './ori.png';

// הגדרת הקטגוריות
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

// פונקציות עזר לעבודה עם תאריך עברי
const HebrewUtils = {
  // שמות ימי השבוע בעברית
  days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],

  /**
   * ממירה מספר יום (1-30) למחרוזת בעברית
   * דוגמה: 29 -> 'כט', 15 -> 'טו'
   */
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

  // המרת שנה לכתיב עברי (לדוגמה: 5785 -> ה'תשפה)
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

  // ממיר שם חודש לועזי (מלוח עברי) לשם עברי
  monthNameToHebrew: (monthName) => {
    const monthMap = {
      Nisan: 'ניסן',
      Iyyar: 'אייר',
      Sivan: 'סיון',
      Tamuz: 'תמוז',
      Av: 'אב',
      Elul: 'אלול',
      Tishrei: 'תשרי',
      Cheshvan: 'חשון',
      Kislev: 'כסלו',
      Tevet: 'טבת',
      "Sh'vat": 'שבט',
      Adar: 'אדר'
    };
    return monthMap[monthName] || monthName;
  }
};

// פונקציה לחישוב גודל פונט דינמי לפי אורך הטקסט
const calculateFontSize = (texts) => {
  const baseSize = 18;
  const maxLength = Math.max(...texts.map((text) => text.length));
  return maxLength <= 200
    ? baseSize
    : Math.max(16, baseSize - Math.floor((maxLength - 200) / 20));
};

function HalachaStatusGenerator() {
  const [category, setCategory] = useState('הלכות חנוכה');
  const [partNumber, setPartNumber] = useState(1);
  const [halachot, setHalachot] = useState([]);
  const [currentHalachaIndex, setCurrentHalachaIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // הגדרת תאריך עברי כברירת מחדל
  const [hebrewDate, setHebrewDate] = useState(() => {
    const hdate = new HDate();
    return {
      dayOfWeek: `יום ${HebrewUtils.days[hdate.getDay()]}`,
      hebrewDate: `${HebrewUtils.gematriyaDay(hdate.getDate())} ${HebrewUtils.monthNameToHebrew(hdate.getMonthName())} ${HebrewUtils.yearToHebrewString(hdate.getFullYear())}`
    };
  });

  // עדכון התאריך העברי כל דקה
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

  // טעינת ההלכות מ-Firestore
  const loadHalachot = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // מבדילים בין 'הלכות שבת' לשאר הקטגוריות
      const docRef =
        category === 'הלכות שבת'
          ? doc(db, 'halachot', `${category}_${partNumber}`)
          : doc(db, 'halachot', category);

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const allHalachot = docSnap.data().halachot || [];
        // מסננים הלכות שעדיין לא נקראו
        const unreadHalachot = allHalachot.filter((halacha) => !halacha.read);

        // אם ההלכה הראשונה ארוכה מ-300 תווים, מציגים רק אותה
        const firstHalacha = unreadHalachot[currentHalachaIndex];
        if (firstHalacha && firstHalacha.text.length > 300) {
          setHalachot([firstHalacha]);
        } else {
          // אחרת, מציגים שתי הלכות בכל פעם
          const currentHalachot = unreadHalachot.slice(
            currentHalachaIndex,
            currentHalachaIndex + 2
          );

          if (currentHalachot.length === 0) {
            setError('לא נמצאו הלכות בקטגוריה זו');
          } else {
            setHalachot(currentHalachot);
          }
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

  // סימון הלכות כנקראו
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
        console.log('ההלכות סומנו כנקראות');
      }
    } catch (err) {
      console.error('שגיאה בעדכון ההלכות:', err);
    }
  };

  // הורדה כתמונה + סימון כנקראו
  const handleDownload = async () => {
    try {
      // קודם נסמן כנקראו
      const halachaIds = halachot.map((halacha) => halacha.id);
      await markAsRead(halachaIds);

      // משתמשים ב-html2canvas כדי לצלם את האלמנט כקנבס
      const html2canvas = (await import('html2canvas')).default;
      const cardElement = document.getElementById('halacha-card');
      if (!cardElement) {
        console.error('אלמנט הכרטיס לא נמצא');
        return;
      }

      // יוצרים צילום של האלמנט
      const canvas = await html2canvas(cardElement, {
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL('image/png');

      // יוצרים קישור הורדה
      const link = document.createElement('a');
      link.download = 'halacha.png';
      link.href = dataUrl;
      link.click();

      alert('ההלכות סומנו כנקראו והתמונה הורדה בהצלחה.');
    } catch (error) {
      console.error('שגיאה בהורדה כתמונה:', error);
      alert('אירעה שגיאה בהמרה להורדה כתמונה');
    }
  };

  // טעינת הלכות נוספות (מעבר הלאה ברשימה)
  const loadNextHalachot = () => {
    setCurrentHalachaIndex((prev) => prev + 2);
  };

  // חישוב גודל הפונט בהתאם לאורך הטקסט
  const fontSize = useMemo(
    () => calculateFontSize(halachot.map((halacha) => halacha.text)),
    [halachot]
  );

  // נטען את ההלכות בכל פעם שמשתנה קטגוריה, חלק, או אינדקס
  useEffect(() => {
    loadHalachot();
  }, [category, partNumber, currentHalachaIndex]);

  return (
    <div style={{ padding: '20px', margin: '0 auto', direction: 'rtl' }}>
      {/* בחירת קטגוריה וחלק (רק לשבת) */}
      <div style={{ marginBottom: '20px' }}>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setCurrentHalachaIndex(0);
          }}
          style={{ padding: '8px', marginRight: '10px' }}
        >
          {Object.keys(CATEGORIES).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {category === 'הלכות שבת' && (
          <select
            value={partNumber}
            onChange={(e) => {
              setPartNumber(Number(e.target.value));
              setCurrentHalachaIndex(0);
            }}
            style={{ padding: '8px' }}
          >
            {[...Array(CATEGORIES[category].parts)].map((_, index) => (
              <option key={index + 1} value={index + 1}>
                {`חלק ${HebrewUtils.gematriyaDay(index + 1)}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* כרטיס ההלכה שעליו נעשה צילום */}
      <div
        id="halacha-card"
        style={{
          width: '420px',
          height: '750px',
          margin: '0 auto',
          backgroundColor: '#FFEFD5',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'left  bottom',
          backgroundSize: '200px',
          backgroundImage: `url(${ori})`,
          padding: '20px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          color: 'black',
          fontFamily: "'David Libre', serif",
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div>טוען הלכות...</div>
        ) : error ? (
          <div style={{ color: 'red' }}>{error}</div>
        ) : (
          <>
            <div style={{ flex: 1 }}>
              <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>
                {/* כותרת: יום בשבוע + תאריך עברי + שם הקטגוריה */}
                {hebrewDate.dayOfWeek}, {hebrewDate.hebrewDate}
                <br />
                {category}
              </h2>
              {halachot.map((halacha) => (
                <p
                  key={halacha.id}
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.6',
                    marginBottom: '15px',
                    textAlign: 'justify',
                  }}
                >
                  {halacha.text}
                </p>
              ))}
            </div>
            <div
              style={{
                borderTop: '1px solid #ccc',
                paddingTop: '10px',
                marginTop: 'auto',
                textAlign: 'center',
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#c00',
                letterSpacing: '1px',
              }}
            >
              לעילוי נשמת אורי בן עינב הי"ד
            </div>
          </>
        )}
      </div>

      {/* כפתורים */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '20px',
          display: 'flex',
          justifyContent: 'center',
          gap: '10px',
        }}
      >
        <button
          onClick={handleDownload}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          הורד כתמונה
        </button>
        <button
          onClick={loadNextHalachot}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          הלכות הבאות
        </button>
      </div>
    </div>
  );
}

export default HalachaStatusGenerator;