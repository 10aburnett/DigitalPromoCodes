'use client';

import { useState, useEffect } from 'react';

export default function PublishingManagementPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/publish-whops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      });
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handlePublish = async (count: number = 250) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/publish-whops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', count })
      });
      const data = await response.json();
      setMessage(data.message);
      await fetchStatus(); // Refresh status
    } catch (error) {
      setMessage('Error publishing whops');
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const handleUnpublish = async (count: number = 250) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/publish-whops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unpublish', count })
      });
      const data = await response.json();
      setMessage(data.message);
      await fetchStatus(); // Refresh status
    } catch (error) {
      setMessage('Error unpublishing whops');
      console.error('Error:', error);
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Whop Publishing Management</h1>
      
      {/* Status Card */}
      {status && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Publication Status</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 p-4 rounded">
              <div className="text-2xl font-bold text-green-600">{status.published}</div>
              <div className="text-green-800">Published</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded">
              <div className="text-2xl font-bold text-yellow-600">{status.unpublished}</div>
              <div className="text-yellow-800">Unpublished</div>
            </div>
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-2xl font-bold text-blue-600">{status.total}</div>
              <div className="text-blue-800">Total</div>
            </div>
          </div>
          <div className="mt-4 text-center text-gray-600">
            {status.unpublished > 0 && (
              <p>At 250 per day, {Math.ceil(status.unpublished / 250)} days remaining for full publication</p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Manual Actions</h2>
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => handlePublish(250)}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Publishing...' : 'Publish 250 Whops'}
          </button>
          
          <button
            onClick={() => handlePublish(50)}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Publishing...' : 'Publish 50 Whops'}
          </button>
          
          <button
            onClick={() => handleUnpublish(250)}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Unpublishing...' : 'Unpublish 250 Whops'}
          </button>
          
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Refresh Status
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
          <p className="text-blue-800">{message}</p>
        </div>
      )}

      {/* Cron Job Info */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Automatic Publishing</h2>
        <div className="space-y-2 text-gray-700">
          <p>• <strong>Schedule:</strong> Daily at 9:30 PM UTC</p>
          <p>• <strong>Batch Size:</strong> 250 whops per day</p>
          <p>• <strong>Method:</strong> Oldest unpublished whops first</p>
          <p>• <strong>Endpoint:</strong> /api/cron/publish-whops</p>
        </div>
      </div>
    </div>
  );
}