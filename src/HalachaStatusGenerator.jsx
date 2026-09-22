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

const btnBase = {
  border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff',
  cursor: 'pointer', lineHeight: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
};

const stepperButtonStyle = { ...btnBase, width: '28px', height: '28px', fontSize: '16px' };

function Stepper({ label, value, onDec, onInc, onDecLarge, onIncLarge, suffix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 10px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
      <span style={{ fontSize: '13px', color: '#333' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {onDecLarge && <button onClick={onDecLarge} style={{ ...stepperButtonStyle, width: '34px', fontSize: '12px', color: '#666' }}>−10</button>}
        <button onClick={onDec} style={stepperButtonStyle}>−</button>
        <span style={{ minWidth: '28px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>{value}</span>
        <button onClick={onInc} style={stepperButtonStyle}>+</button>
        {onIncLarge && <button onClick={onIncLarge} style={{ ...stepperButtonStyle, width: '34px', fontSize: '12px', color: '#666' }}>+10</button>}
        {suffix && <span style={{ color: '#888', fontSize: '12px', minWidth: '38px' }}>{suffix}</span>}
      </div>
    </div>
  );
}

function BrowseScreen({ onSelectForCard, onBack }) {
  const [browseCategory, setBrowseCategory] = useState('הלכות חנוכה');
  const [browsePartNumber, setBrowsePartNumber] = useState(1);
  const [browseFilter, setBrowseFilter] = useState('all');
  const [allHalachot, setAllHalachot] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setSelected(new Set());
      try {
        const docRef = browseCategory === 'הלכות שבת'
          ? doc(db, 'halachot', `${browseCategory}_${browsePartNumber}`)
          : doc(db, 'halachot', browseCategory);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setAllHalachot(snap.data().halachot || []);
        } else {
          setAllHalachot([]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [browseCategory, browsePartNumber]);

  const filtered = useMemo(() => {
    if (browseFilter === 'all') return allHalachot;
    if (browseFilter === 'unread') return allHalachot.filter((h) => !h.read);
    return allHalachot.filter((h) => h.read);
  }, [allHalachot, browseFilter]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendToCard = () => {
    const chosen = filtered.filter((h) => selected.has(h.id));
    if (chosen.length > 0) onSelectForCard(chosen);
  };

  const filterLabels = { all: 'הכל', unread: 'לא נקראו', read: 'נקראו' };

  return (
    <div style={{ padding: '16px', direction: 'rtl', maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <button onClick={onBack} style={{ ...btnBase, padding: '7px 14px', fontSize: '14px' }}>← חזור</button>
        <h2 style={{ margin: 0, fontSize: '18px' }}>עיון בהלכות</h2>
        {selected.size > 0 && (
          <button
            onClick={handleSendToCard}
            style={{ marginRight: 'auto', padding: '7px 14px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
          >
            שמור לכרטיס ({selected.size})
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <select
          value={browseCategory}
          onChange={(e) => { setBrowseCategory(e.target.value); setBrowsePartNumber(1); }}
          style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px' }}
        >
          {Object.keys(CATEGORIES).map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {browseCategory === 'הלכות שבת' && (
          <select
            value={browsePartNumber}
            onChange={(e) => setBrowsePartNumber(Number(e.target.value))}
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px' }}
          >
            {[...Array(CATEGORIES[browseCategory].parts)].map((_, i) => (
              <option key={i + 1} value={i + 1}>{`חלק ${HebrewUtils.gematriyaDay(i + 1)}`}</option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {Object.entries(filterLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setBrowseFilter(key)}
            style={{
              flex: 1, padding: '7px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer',
              border: '1px solid ' + (browseFilter === key ? '#007bff' : '#ccc'),
              backgroundColor: browseFilter === key ? '#007bff' : '#fff',
              color: browseFilter === key ? 'white' : '#333',
              fontWeight: browseFilter === key ? 'bold' : 'normal'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>טוען...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>לא נמצאו הלכות</div>
      ) : (
        <div>
          {filtered.map((h) => {
            const isSelected = selected.has(h.id);
            return (
              <div
                key={h.id}
                onClick={() => toggleSelect(h.id)}
                style={{
                  padding: '12px 14px', marginBottom: '8px', borderRadius: '8px', cursor: 'pointer',
                  border: '2px solid ' + (isSelected ? '#007bff' : '#e5e7eb'),
                  backgroundColor: isSelected ? '#e8f0fe' : '#fff',
                  transition: 'all 0.15s'
                }}
              >
                <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', textAlign: 'justify' }}>{h.text}</p>
                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>#{h.id}</span>
                  <span style={{ fontSize: '12px', color: h.read ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                    {h.read ? '✓ נקרא' : '● לא נקרא'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HalachaStatusGenerator() {
  const [screen, setScreen] = useState('generator');
  const [pinnedHalachot, setPinnedHalachot] = useState(null);

  const [category, setCategory] = useState('הלכות חנוכה');
  const [partNumber, setPartNumber] = useState(1);
  const [viewMode, setViewMode] = useState('unread');
  const [halachot, setHalachot] = useState([]);
  const [currentHalachaIndex, setCurrentHalachaIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stepSize, setStepSize] = useState(2);
  const [halachotCount, setHalachotCount] = useState(2);
  const [stripChars, setStripChars] = useState(0);
  const [fontSizeOffset, setFontSizeOffset] = useState(0);
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
    if (pinnedHalachot) return;
    setIsLoading(true);
    setError(null);
    try {
      const docRef = category === 'הלכות שבת'
        ? doc(db, 'halachot', `${category}_${partNumber}`)
        : doc(db, 'halachot', category);

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const allHalachot = docSnap.data().halachot || [];
        const filteredHalachot = viewMode === 'unread'
          ? allHalachot.filter((h) => !h.read)
          : allHalachot.filter((h) => h.read);

        const collected = filteredHalachot.slice(currentHalachaIndex, currentHalachaIndex + halachotCount);

        if (collected.length === 0) {
          setError(viewMode === 'unread' ? 'לא נמצאו הלכות בקטגוריה זו' : 'לא נמצאו הלכות שנקראו בקטגוריה זו');
        } else {
          setHalachot(collected);
        }
      } else {
        setError(viewMode === 'unread' ? 'לא נמצאו הלכות בקטגוריה זו' : 'לא נמצאו הלכות שנקראו בקטגוריה זו');
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
      const docRef = category === 'הלכות שבת'
        ? doc(db, 'halachot', `${category}_${partNumber}`)
        : doc(db, 'halachot', category);

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const allHalachot = docSnap.data().halachot || [];
        const updatedHalachot = allHalachot.map((halacha) =>
          halachaIds.includes(halacha.id) ? { ...halacha, read: true } : halacha
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
      if (!pinnedHalachot && viewMode === 'unread') {
        const halachaIds = displayHalachot.map((h) => h.id);
        await markAsRead(halachaIds);
        await downloadCardAsImage();
        alert('ההלכות סומנו כנקראו והתמונה הורדה בהצלחה.');
      } else {
        await downloadCardAsImage();
        alert('התמונה הורדה בהצלחה.');
      }
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

  const loadNextHalachot = () => setCurrentHalachaIndex((prev) => prev + stepSize);
  const loadPreviousHalachot = () => setCurrentHalachaIndex((prev) => Math.max(prev - stepSize, 0));
  const loadNextHalachot10 = () => setCurrentHalachaIndex((prev) => prev + 10);
  const loadPreviousHalachot10 = () => setCurrentHalachaIndex((prev) => Math.max(prev - 10, 0));

  const processText = (text) => {
    if (stripChars === 0) return text;
    return text.substring(stripChars).replace(/^[.\s]+/, '');
  };

  const displayHalachot = pinnedHalachot ?? halachot;
  const fontSize = useMemo(
    () => calculateFontSize(displayHalachot.length ? displayHalachot.map((h) => h.text) : ['']),
    [displayHalachot]
  ) + fontSizeOffset;

  useEffect(() => {
    loadHalachot();
  }, [category, partNumber, currentHalachaIndex, halachotCount, viewMode, pinnedHalachot]);

  const switchViewMode = (mode) => {
    setViewMode(mode);
    setCurrentHalachaIndex(0);
  };

  if (screen === 'browse') {
    return (
      <BrowseScreen
        onSelectForCard={(chosen) => { setPinnedHalachot(chosen); setScreen('generator'); }}
        onBack={() => setScreen('generator')}
      />
    );
  }

  return (
    <div style={{ padding: '16px', margin: '0 auto', direction: 'rtl', maxWidth: '640px' }}>
      <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <button
            onClick={() => switchViewMode('unread')}
            style={{
              flex: 1, padding: '8px 12px',
              backgroundColor: viewMode === 'unread' ? '#007bff' : '#fff',
              color: viewMode === 'unread' ? 'white' : '#333',
              border: '1px solid ' + (viewMode === 'unread' ? '#007bff' : '#ccc'),
              borderRadius: '6px', cursor: 'pointer',
              fontWeight: viewMode === 'unread' ? 'bold' : 'normal', fontSize: '14px'
            }}
          >
            הלכות חדשות
          </button>
          <button
            onClick={() => switchViewMode('read')}
            style={{
              flex: 1, padding: '8px 12px',
              backgroundColor: viewMode === 'read' ? '#007bff' : '#fff',
              color: viewMode === 'read' ? 'white' : '#333',
              border: '1px solid ' + (viewMode === 'read' ? '#007bff' : '#ccc'),
              borderRadius: '6px', cursor: 'pointer',
              fontWeight: viewMode === 'read' ? 'bold' : 'normal', fontSize: '14px'
            }}
          >
            הלכות שנקראו
          </button>
          <button
            onClick={() => setScreen('browse')}
            style={{
              padding: '8px 12px', backgroundColor: '#fff', color: '#333',
              border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
            }}
          >
            עיון
          </button>
        </div>

        {pinnedHalachot && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>
            <span>מוצגות {pinnedHalachot.length} הלכות שנבחרו מעיון</span>
            <button
              onClick={() => setPinnedHalachot(null)}
              style={{ padding: '3px 8px', backgroundColor: '#ffc107', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              נקה
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setCurrentHalachaIndex(0); }} style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#fff', fontSize: '14px' }}>
            {Object.keys(CATEGORIES).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {category === 'הלכות שבת' && (
            <select value={partNumber} onChange={(e) => { setPartNumber(Number(e.target.value)); setCurrentHalachaIndex(0); }} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#fff', fontSize: '14px' }}>
              {[...Array(CATEGORIES[category].parts)].map((_, index) => (
                <option key={index + 1} value={index + 1}>{`חלק ${HebrewUtils.gematriyaDay(index + 1)}`}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
          <Stepper
            label="הלכות בכרטיס"
            value={halachotCount}
            onDec={() => setHalachotCount((c) => Math.max(c - 1, 1))}
            onInc={() => setHalachotCount((c) => c + 1)}
          />
          <Stepper
            label="קידום / חזרה"
            value={stepSize}
            onDec={() => setStepSize((s) => Math.max(s - 1, 1))}
            onInc={() => setStepSize((s) => s + 1)}
            onDecLarge={() => setStepSize((s) => Math.max(s - 10, 1))}
            onIncLarge={() => setStepSize((s) => s + 10)}
          />
          <Stepper
            label="מחיקת אות סעיף"
            value={stripChars}
            onDec={() => setStripChars((c) => Math.max(c - 1, 0))}
            onInc={() => setStripChars((c) => Math.min(c + 1, 3))}
          />
          <Stepper
            label="גודל פונט"
            value={fontSizeOffset > 0 ? `+${fontSizeOffset}` : fontSizeOffset}
            onDec={() => setFontSizeOffset((o) => o - 1)}
            onInc={() => setFontSizeOffset((o) => o + 1)}
            suffix={`${fontSize}px`}
          />
        </div>
      </div>

      <div style={{ width: `${420 * cardScale}px`, height: `${750 * cardScale}px`, margin: '0 auto' }}>
        <div id="halacha-card" style={{ width: '420px', height: '750px', transform: `scale(${cardScale})`, transformOrigin: 'top right', backgroundColor: '#FFEFD5', backgroundRepeat: 'no-repeat', backgroundPosition: 'left bottom', backgroundSize: '200px', backgroundImage: `url(${ori})`, padding: '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', color: 'black', fontFamily: "'David Libre', serif", boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {isLoading && !pinnedHalachot ? (
            <div>טוען הלכות...</div>
          ) : error && !pinnedHalachot ? (
            <div style={{ color: 'red' }}>{error}</div>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>{hebrewDate.dayOfWeek}, {hebrewDate.hebrewDate}<br />{category}</h2>
                {displayHalachot.map((halacha) => (
                  <p key={halacha.id} style={{ fontSize: `${fontSize}px`, lineHeight: '1.6', marginBottom: '15px', textAlign: 'justify' }}>{processText(halacha.text)}</p>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #ccc', paddingTop: '10px', marginTop: 'auto', textAlign: 'center', fontSize: '28px', fontWeight: 'bold', color: '#c00', letterSpacing: '1px' }}>לעילוי נשמת אורי בן עינב הי"ד</div>
            </>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', opacity: currentHalachaIndex === 0 ? 0.5 : 1 }}>
          <button onClick={loadPreviousHalachot10} disabled={currentHalachaIndex === 0} style={{ padding: '10px 12px', backgroundColor: '#c62828', color: 'white', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '13px' }}>10«</button>
          <button onClick={loadPreviousHalachot} disabled={currentHalachaIndex === 0} style={{ padding: '10px 16px', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px' }}>הלכות קודמות</button>
        </div>
        <button onClick={handleDownload} style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>הורד וסמן כנקרא</button>
        <button onClick={handleDownloadOnly} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>הורד בלבד</button>
        <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden' }}>
          <button onClick={loadNextHalachot} style={{ padding: '10px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px' }}>הלכות הבאות</button>
          <button onClick={loadNextHalachot10} style={{ padding: '10px 12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRight: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '13px' }}>»10</button>
        </div>
      </div>
    </div>
  );
}

export default HalachaStatusGenerator;
