import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

// ייבוא כל קבצי ה-JSON
import brachot from './category/הלכות ברכות.json';
import chanuka from './category/הלכות חנוכה.json';
import yamimNoraim from './category/הלכות ימים נוראים.json';
import sukot from './category/הלכות סוכה.json';
import purim from './category/הלכות פורים.json';
import pesach from './category/הלכות פסח.json';
import shabbat from './category/הלכות שבת.json';
import taanit from './category/הלכות תעניות.json';

const UploadData = () => {
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  const allCategories = {
    'הלכות ברכות': brachot['הלכות ברכות'],
    'הלכות חנוכה': chanuka['הלכות חנוכה'],
    'הלכות ימים נוראים': yamimNoraim['הלכות ימים נוראים'],
    'הלכות סוכה': sukot['הלכות סוכה'],
    'הלכות פורים': purim['הלכות פורים'],
    'הלכות פסח': pesach['הלכות פסח'],
    'הלכות שבת': shabbat['הלכות שבת'],
    'הלכות תעניות': taanit['הלכות תעניות']
  };

  useEffect(() => {
    checkFirebaseConnection();
  }, []);

  const checkFirebaseConnection = async () => {
    setCheckingConnection(true);
    try {
      const testRef = doc(db, '_test_connection_', 'test');
      await setDoc(testRef, { timestamp: new Date() });
      
      setIsConnected(true);
      setStatus('מחובר ל-Firebase בהצלחה');
      console.log('Firebase connection successful');
    } catch (error) {
      console.error('Firebase connection error:', error);
      setIsConnected(false);
      setStatus('שגיאה בהתחברות ל-Firebase');
    } finally {
      setCheckingConnection(false);
    }
  };

  const clearDatabase = async () => {
    try {
      setStatus('מוחק נתונים קיימים...');
      
      // מחיקת כל המסמכים מ-collection של הלכות
      const halachotSnapshot = await getDocs(collection(db, 'halachot'));
      for (const document of halachotSnapshot.docs) {
        await deleteDoc(doc(db, 'halachot', document.id));
      }

      // מחיקת כל המסמכים מ-collection של קטגוריות
      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      for (const document of categoriesSnapshot.docs) {
        await deleteDoc(doc(db, 'categories', document.id));
      }

      console.log('Database cleared successfully');
      setStatus('הנתונים הקיימים נמחקו בהצלחה');
    } catch (error) {
      console.error('Error clearing database:', error);
      setStatus('שגיאה במחיקת הנתונים הקיימים');
      throw error;
    }
  };

  const uploadData = async () => {
    if (!isConnected) {
      setStatus('לא ניתן להעלות נתונים - אין חיבור ל-Firebase');
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      // מחיקת כל הנתונים הקיימים לפני העלאה חדשה
      await clearDatabase();
      
      const totalCategories = Object.keys(allCategories).length;
      let completedCategories = 0;

      for (const [category, halachotList] of Object.entries(allCategories)) {
        setStatus(`מעלה ${category}...`);
        
        if (category === 'הלכות שבת') {
          // חלוקת הלכות שבת ל-2 חלקים
          const halfLength = Math.ceil(halachotList.length / 2);
          const firstHalf = halachotList.slice(0, halfLength);
          const secondHalf = halachotList.slice(halfLength);

          // העלאת החלק הראשון
          await setDoc(doc(db, 'halachot', `${category}_1`), {
            categoryName: category,
            partNumber: 1,
            totalParts: 2,
            halachot: firstHalf.map(halacha => ({
              ...halacha,
              read: false,
              lastRead: null
            }))
          });

          // העלאת החלק השני
          await setDoc(doc(db, 'halachot', `${category}_2`), {
            categoryName: category,
            partNumber: 2,
            totalParts: 2,
            halachot: secondHalf.map(halacha => ({
              ...halacha,
              read: false,
              lastRead: null
            }))
          });

          // מטא-דאטה להלכות שבת
          await setDoc(doc(db, 'categories', category), {
            name: category,
            totalParts: 2,
            totalHalachot: halachotList.length,
            lastUpdated: new Date()
          });
        } else {
          // כל שאר הקטגוריות נשארות כמו שהן
          await setDoc(doc(db, 'halachot', category), {
            categoryName: category,
            halachot: halachotList.map(halacha => ({
              ...halacha,
              read: false,
              lastRead: null
            }))
          });
        }
        
        completedCategories++;
        setProgress((completedCategories / totalCategories) * 100);
        console.log(`Successfully uploaded ${category}`);
      }
      
      setStatus('כל הנתונים הועלו בהצלחה! 🎉');
    } catch (error) {
      console.error('Error uploading data:', error);
      setStatus(`שגיאה בהעלאת הנתונים: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      {/* סטטוס חיבור */}
      <div className={`mb-4 p-2 rounded text-center ${
        checkingConnection ? 'bg-yellow-100' :
        isConnected ? 'bg-green-100' : 'bg-red-100'
      }`}>
        {checkingConnection ? (
          <p>בודק חיבור ל-Firebase... ⏳</p>
        ) : isConnected ? (
          <p className="text-green-700">מחובר ל-Firebase ✅</p>
        ) : (
          <div>
            <p className="text-red-700 mb-2">אין חיבור ל-Firebase ❌</p>
            <button
              onClick={checkFirebaseConnection}
              className="bg-blue-500 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded"
            >
              נסה שוב
            </button>
          </div>
        )}
      </div>

      {/* כפתור העלאה */}
      <button 
        onClick={uploadData}
        disabled={!isConnected || isUploading || checkingConnection}
        className={`w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4 ${
          (!isConnected || isUploading || checkingConnection) ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {checkingConnection ? 'בודק חיבור...' :
         !isConnected ? 'אין חיבור ל-Firebase' :
         isUploading ? 'מעלה נתונים...' : 
         'העלה את כל ההלכות ל-Firestore'}
      </button>

      {status && (
        <div className="mb-4 text-center font-medium">
          {status}
        </div>
      )}

      {isUploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {/* טבלת סטטוס */}
      {isUploading && (
        <div className="mt-4">
          <h3 className="font-bold mb-2">סטטוס העלאה:</h3>
          <div className="border rounded">
            {Object.keys(allCategories).map((category) => (
              <div 
                key={category}
                className="p-2 border-b last:border-b-0 flex justify-between items-center"
              >
                <span>{category}</span>
                <span className="text-sm">
                  {progress >= ((Object.keys(allCategories).indexOf(category) + 1) / Object.keys(allCategories).length * 100) 
                    ? '✅ הושלם' 
                    : status.includes(category) 
                      ? '🔄 בתהליך' 
                      : '⏳ ממתין'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadData;