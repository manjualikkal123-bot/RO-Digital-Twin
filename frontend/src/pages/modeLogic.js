export const applyModeOverrides = (baseDictionary, tab, mode) => {
 // Deep clone to avoid mutating base
 const dict = JSON.parse(JSON.stringify(baseDictionary));

 const setValve = (id, state) => {
 if (dict[id]) {
 dict[id].tags.forEach(tag => {
 if (tag.desc === 'Logic Command' || tag.desc === 'Valve State' || tag.desc === 'Status') {
 tag.value = state;
 }
 });
 }
 };

 const setPump = (id, state) => {
 if (dict[id]) {
 dict[id].tags.forEach(tag => {
 if (tag.desc === 'Status' || tag.desc === 'Run Status' || tag.id === 'STATUS') {
 tag.value = state;
 }
 });
 }
 };

 // --- MANUAL MODE ---
 if (mode === 'MANUAL') return dict;

 // ── UF SYSTEMS (UF-101, UF-201) ──
 if (tab === 'UF101' || tab === 'UF201') {
 const baseAV = tab === 'UF101' ? 100 : 200;
 const pFeed1 = tab === 'UF101' ? 'P-101' : 'P-201';
 const pFeed2 = tab === 'UF101' ? 'P-102' : 'P-202';
 const pMCF = tab === 'UF101' ? 'P-103' : 'P-203';
 const pSys = tab === 'UF101' ? 'P-104' : 'P-204';
 const pCIP = tab === 'UF101' ? 'P-105' : 'P-205';

 if (mode === 'SERVICE') {
 setPump(pFeed1, 'RUNNING'); setPump(pFeed2, 'RUNNING');
 setPump(pMCF, 'RUNNING'); setPump(pSys, 'RUNNING'); setPump(pCIP, 'STOPPED');
 
 setValve(`AV-${baseAV + 2}`, 'OPEN'); setValve(`AV-${baseAV + 3}`, 'OPEN'); // MCF-A
 setValve(`AV-${baseAV + 6}`, 'OPEN'); setValve(`AV-${baseAV + 7}`, 'OPEN'); // MCF-B
 setValve(`AV-${baseAV + 10}`, 'OPEN'); // Perm to RO
 setValve(`AV-${baseAV + 12}`, 'OPEN'); // Reject to Drain
 setValve(`AV-${baseAV + 18}`, 'OPEN'); // Perm exit block

 setValve(`AV-${baseAV + 4}`, 'CLOSED'); setValve(`AV-${baseAV + 5}`, 'CLOSED');
 setValve(`AV-${baseAV + 8}`, 'CLOSED'); setValve(`AV-${baseAV + 9}`, 'CLOSED');
 setValve(`AV-${baseAV + 11}`, 'CLOSED'); setValve(`AV-${baseAV + 13}`, 'CLOSED');
 setValve(`AV-${baseAV + 14}`, 'CLOSED'); setValve(`AV-${baseAV + 15}`, 'CLOSED');
 setValve(`AV-${baseAV + 16}`, 'CLOSED'); setValve(`AV-${baseAV + 17}`, 'CLOSED');
 setValve(`AV-${baseAV + 19}`, 'CLOSED');
 }
 
 if (mode === 'CIP') {
 setPump(pFeed1, 'STOPPED'); setPump(pFeed2, 'STOPPED');
 setPump(pMCF, 'STOPPED'); setPump(pSys, 'RUNNING'); setPump(pCIP, 'RUNNING');
 
 setValve(`AV-${baseAV + 2}`, 'CLOSED'); setValve(`AV-${baseAV + 3}`, 'CLOSED'); 
 setValve(`AV-${baseAV + 6}`, 'CLOSED'); setValve(`AV-${baseAV + 7}`, 'CLOSED'); 
 setValve(`AV-${baseAV + 10}`, 'CLOSED'); setValve(`AV-${baseAV + 12}`, 'CLOSED'); 

 setValve(`AV-${baseAV + 16}`, 'OPEN'); // CIP Feed
 setValve(`AV-${baseAV + 19}`, 'OPEN'); // CIP Outlet
 setValve(`AV-${baseAV + 11}`, 'OPEN'); // Perm Flush Rtn
 setValve(`AV-${baseAV + 13}`, 'OPEN'); // Reject Rtn A
 setValve(`AV-${baseAV + 14}`, 'OPEN'); // Reject Rtn B
 setValve(`AV-${baseAV + 15}`, 'OPEN'); // Reject Rtn C
 }

 if (mode === 'AIR_SCOUR') {
 setPump(pFeed1, 'STOPPED'); setPump(pFeed2, 'STOPPED');
 setPump(pMCF, 'STOPPED'); setPump(pSys, 'STOPPED'); setPump(pCIP, 'STOPPED');
 
 for(let i=1; i<=19; i++) setValve(`AV-${baseAV + i}`, 'CLOSED');
 
 setValve(`AV-${baseAV + 17}`, 'OPEN'); // Air Scour Inlet
 setValve(`AV-${baseAV + 12}`, 'OPEN'); // Reject to Drain
 }

 if (mode === 'FLUSHING') {
 setPump(pFeed1, 'STOPPED'); setPump(pFeed2, 'STOPPED');
 setPump(pMCF, 'STOPPED'); setPump(pSys, 'RUNNING'); setPump(pCIP, 'RUNNING');
 
 for(let i=1; i<=19; i++) setValve(`AV-${baseAV + i}`, 'CLOSED');
 
 setValve(`AV-${baseAV + 16}`, 'OPEN'); // CIP Feed
 setValve(`AV-${baseAV + 19}`, 'OPEN'); // CIP Outlet
 setValve(`AV-${baseAV + 12}`, 'OPEN'); // Reject to Drain
 }
 }

 // ── RO-1 SYSTEM (RO-401, RO-501) ──
 if (tab === 'RO401' || tab === 'RO501') {
 const baseAV = tab === 'RO401' ? 400 : 500;
 const pFeed = tab === 'RO401' ? 'P-401' : 'P-501';
 const pHP = tab === 'RO401' ? 'P-402' : 'P-502';
 const pIB1 = tab === 'RO401' ? 'P-403' : 'P-503';
 const pIB2 = tab === 'RO401' ? 'P-404' : 'P-504';
 const pCIP = 'P-405';
 const dosing1 = tab === 'RO401' ? 'DP-401' : 'DP-501';
 const dosing2 = tab === 'RO401' ? 'DP-402' : 'DP-502';

 if (mode === 'SERVICE') {
 setPump(pFeed, 'RUNNING'); setPump(pHP, 'RUNNING'); setPump(pIB1, 'RUNNING'); setPump(pIB2, 'RUNNING');
 setPump(pCIP, 'STOPPED'); setPump(dosing1, 'RUNNING'); setPump(dosing2, 'RUNNING');
 
 setValve(`AV-${baseAV + 1}`, 'OPEN'); setValve(`AV-${baseAV + 2}`, 'OPEN'); 
 setValve(`AV-${baseAV + 3}`, 'OPEN'); setValve(`AV-${baseAV + 4}`, 'OPEN'); 
 for(let i=5; i<=11; i++) setValve(`AV-${baseAV + i}`, 'CLOSED');
 }

 if (mode === 'CIP') {
 setPump(pFeed, 'STOPPED'); setPump(pHP, 'STOPPED'); setPump(pIB1, 'RUNNING'); setPump(pIB2, 'RUNNING');
 setPump(pCIP, 'RUNNING'); setPump(dosing1, 'STOPPED'); setPump(dosing2, 'STOPPED');

 for(let i=1; i<=11; i++) setValve(`AV-${baseAV + i}`, 'CLOSED');
 
 setValve(`AV-${baseAV + 6}`, 'OPEN'); setValve(`AV-${baseAV + 7}`, 'OPEN'); 
 setValve(`AV-${baseAV + 8}`, 'OPEN'); setValve(`AV-${baseAV + 9}`, 'OPEN'); 
 setValve(`AV-${baseAV + 10}`, 'OPEN'); 
 }

 if (mode === 'FLUSHING') {
 setPump(pFeed, 'STOPPED'); setPump(pHP, 'STOPPED'); setPump(pIB1, 'RUNNING'); setPump(pIB2, 'RUNNING');
 setPump(pCIP, 'RUNNING'); setPump(dosing1, 'STOPPED'); setPump(dosing2, 'STOPPED');

 for(let i=1; i<=11; i++) setValve(`AV-${baseAV + i}`, 'CLOSED');
 setValve(`AV-${baseAV + 6}`, 'OPEN'); // CIP Inlet
 setValve(`AV-${baseAV + 3}`, 'OPEN'); setValve(`AV-${baseAV + 4}`, 'OPEN'); // Reject/Drain
 }
 }

 // ── RO-2 SYSTEM (RO-701, RO-801) ──
 if (tab === 'RO701' || tab === 'RO801') {
 const baseAV = tab === 'RO701' ? 700 : 800;
 const pFeed = tab === 'RO701' ? 'P-701' : 'P-801';
 const pHP = tab === 'RO701' ? 'P-702' : 'P-802';
 const pIB = tab === 'RO701' ? 'P-703' : 'P-803';
 const pCIP = tab === 'RO701' ? 'P-704' : 'P-804';
 const dosing1 = tab === 'RO701' ? 'DP-701' : 'DP-801';

 if (mode === 'SERVICE') {
 setPump(pFeed, 'RUNNING'); setPump(pHP, 'RUNNING'); setPump(pIB, 'RUNNING');
 setPump(pCIP, 'STOPPED'); setPump(dosing1, 'RUNNING');
 
 setValve(`AV-${baseAV + 1}`, 'OPEN'); setValve(`AV-${baseAV + 2}`, 'OPEN'); 
 setValve(`AV-${baseAV + 3}`, 'OPEN'); setValve(`AV-${baseAV + 4}`, 'OPEN'); 
 
 for(let i=5; i<=14; i++) {
 if(i===10 || i===11 || i===12 || i===13) setValve(`AV-${baseAV + i}`, 'OPEN');
 else setValve(`AV-${baseAV + i}`, 'CLOSED');
 }
 }

 if (mode === 'CIP') {
 setPump(pFeed, 'STOPPED'); setPump(pHP, 'STOPPED'); setPump(pIB, 'RUNNING');
 setPump(pCIP, 'RUNNING'); setPump(dosing1, 'STOPPED');

 for(let i=1; i<=14; i++) setValve(`AV-${baseAV + i}`, 'CLOSED');
 
 setValve(`AV-${baseAV + 8}`, 'OPEN'); setValve(`AV-${baseAV + 14}`, 'OPEN'); 
 setValve(`AV-${baseAV + 6}`, 'OPEN'); setValve(`AV-${baseAV + 7}`, 'OPEN'); 
 setValve(`AV-${baseAV + 5}`, 'OPEN'); 
 }

 if (mode === 'FLUSHING') {
 setPump(pFeed, 'STOPPED'); setPump(pHP, 'STOPPED'); setPump(pIB, 'RUNNING');
 setPump(pCIP, 'RUNNING'); setPump(dosing1, 'STOPPED');

 for(let i=1; i<=14; i++) setValve(`AV-${baseAV + i}`, 'CLOSED');
 
 setValve(`AV-${baseAV + 8}`, 'OPEN'); setValve(`AV-${baseAV + 14}`, 'OPEN'); 
 setValve(`AV-${baseAV + 3}`, 'OPEN'); 
 }
 }

 // ── ROP POLISHER (ROP-1001) ──
 if (tab === 'ROP1001') {
 const pFeed = 'P-1001';
 const pHP = 'P-1002';
 const dosing1 = 'DP-1001';

 if (mode === 'SERVICE') {
 setPump(pFeed, 'RUNNING'); setPump(pHP, 'RUNNING'); setPump(dosing1, 'RUNNING');
 
 setValve(`AV-1001`, 'OPEN'); setValve(`AV-1004`, 'OPEN');
 setValve(`AV-1002`, 'CLOSED'); setValve(`AV-1003`, 'CLOSED');
 setValve(`AV-1005`, 'CLOSED'); setValve(`AV-1006`, 'CLOSED');
 setValve(`AV-1007`, 'CLOSED'); setValve(`AV-1008`, 'CLOSED');
 }

 if (mode === 'CIP') {
 setPump(pFeed, 'STOPPED'); setPump(pHP, 'RUNNING'); setPump(dosing1, 'STOPPED');

 for(let i=1; i<=8; i++) setValve(`AV-100${i}`, 'CLOSED');
 
 setValve(`AV-1007`, 'OPEN'); // CIP Inlet
 setValve(`AV-1008`, 'OPEN'); // CIP Outlet
 setValve(`AV-1002`, 'OPEN'); // Perm Return
 setValve(`AV-1005`, 'OPEN'); // Reject Return
 }

 if (mode === 'FLUSHING') {
 setPump(pFeed, 'STOPPED'); setPump(pHP, 'RUNNING'); setPump(dosing1, 'STOPPED');

 for(let i=1; i<=8; i++) setValve(`AV-100${i}`, 'CLOSED');
 
 setValve(`AV-1007`, 'OPEN'); setValve(`AV-1008`, 'OPEN'); 
 setValve(`AV-1004`, 'OPEN'); // Reject to RO-1
 }
 }

 return dict;
};
