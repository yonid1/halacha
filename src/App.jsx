import React from 'react';
import UploadData from './UploadData.jsx';
import HalachaStatusGenerator from './HalachaStatusGenerator.jsx'

function App() {
  return (
    <div>
<HalachaStatusGenerator/>
      {/* <UploadData /> */}
      <h1 className="text-2xl font-bold text-center my-4">העלאת נתונים ל-Firebase</h1>
    </div>
  );
}

export default App;