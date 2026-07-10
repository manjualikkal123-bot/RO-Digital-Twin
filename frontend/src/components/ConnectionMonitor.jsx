import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const fetchWithTimeout = async (url, options = {}, timeout = 3000) => {
 const controller = new AbortController();
 const id = setTimeout(() => controller.abort(), timeout);
 try {
 const response = await fetch(url, { ...options, signal: controller.signal });
 clearTimeout(id);
 return response;
 } catch (error) {
 clearTimeout(id);
 throw error;
 }
};

export default function ConnectionMonitor() {
 const prevNodeOnline = useRef(true);
 const prevMlOnline = useRef(true);

 useEffect(() => {
 const checkConnections = async () => {
 try {
 const res = await fetchWithTimeout('/api/plants', { method: 'GET' }, 2000);
 if (res.status === 502 || res.status === 504) throw new Error("Gateway Error");
 if (!prevNodeOnline.current) {
 toast.success("Node Backend is back online");
 prevNodeOnline.current = true;
 }
 } catch (e) {
 if (prevNodeOnline.current) {
 toast.error("Node Backend went offline", { duration: 8000 });
 prevNodeOnline.current = false;
 }
 }

 try {
 const mlRes = await fetchWithTimeout('/api/predict-membrane?plantId=jetl_hyderabad', { method: 'GET' }, 3000);
 if (mlRes.status === 503 || mlRes.status === 502 || mlRes.status === 504) throw new Error("ML Offline");
 if (!prevMlOnline.current) {
 toast.success("ML Engine is back online");
 prevMlOnline.current = true;
 }
 } catch (e) {
 if (prevMlOnline.current) {
 toast.error("ML Engine went offline", { duration: 8000 });
 prevMlOnline.current = false;
 }
 }
 };

 const intervalId = setInterval(checkConnections, 3000);
 return () => clearInterval(intervalId);
 }, []);

 return null; // Invisible component, triggers global toasts
}
