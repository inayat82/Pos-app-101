import React, { useState, useEffect } from 'react';
import { 
  FiBell, 
  FiCheck, 
  FiX,
  FiAlertTriangle,
  FiInfo,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiFilter,
  FiSearch
} from 'react-icons/fi';
import { db } from '@/lib/firebase/firebase';
import { 
  collection, 
  query, 
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  where,
  Timestamp
} from 'firebase/firestore';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  isArchived: boolean;
  timestamp: Timestamp;
  actionUrl?: string;
  actionText?: string;
  userId?: string;
  source: string;
}

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'important'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, [filter, typeFilter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      
      let q = query(
        collection(db, 'notifications'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );

      if (filter === 'unread') {
        q = query(
          collection(db, 'notifications'),
          where('isRead', '==', false),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
      } else if (filter === 'important') {
        q = query(
          collection(db, 'notifications'),
          where('priority', 'in', ['high', 'critical']),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
      }

      const querySnapshot = await getDocs(q);
      const notificationsData: Notification[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notificationsData.push({
          id: doc.id,
          title: data.title || 'Notification',
          message: data.message || '',
          type: data.type || 'info',
          priority: data.priority || 'medium',
          isRead: data.isRead || false,
          isArchived: data.isArchived || false,
          timestamp: data.timestamp || Timestamp.now(),
          actionUrl: data.actionUrl,
          actionText: data.actionText,
          userId: data.userId,
          source: data.source || 'System'
        });
      });

      setNotifications(notificationsData);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true
      });
      
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAsArchived = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isArchived: true
      });
      
      setNotifications(prev => 
        prev.filter(notif => notif.id !== notificationId)
      );
    } catch (error) {
      console.error('Error archiving notification:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      await Promise.all(
        unreadNotifications.map(notif => 
          updateDoc(doc(db, 'notifications', notif.id), { isRead: true })
        )
      );
      
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <FiCheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <FiAlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <FiXCircle className="h-5 w-5 text-red-600" />;
      default:
        return <FiInfo className="h-5 w-5 text-blue-600" />;
    }
  };

  const getNotificationBorder = (type: Notification['type'], priority: Notification['priority']) => {
    const baseClasses = 'border-l-4';
    
    if (priority === 'critical') {
      return `${baseClasses} border-red-500`;
    } else if (priority === 'high') {
      return `${baseClasses} border-orange-500`;
    }
    
    switch (type) {
      case 'success':
        return `${baseClasses} border-green-500`;
      case 'warning':
        return `${baseClasses} border-yellow-500`;
      case 'error':
        return `${baseClasses} border-red-500`;
      default:
        return `${baseClasses} border-blue-500`;
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || notification.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading notifications...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <FiBell className="h-6 w-6 text-blue-600 mr-3" />
          <h2 className="text-xl font-semibold text-gray-800">Notification Center</h2>
          {unreadCount > 0 && (
            <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center">
          <FiSearch className="h-4 w-4 text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center">
          <FiFilter className="h-4 w-4 text-gray-400 mr-2" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Notifications</option>
            <option value="unread">Unread Only</option>
            <option value="important">Important Only</option>
          </select>
        </div>

        <div className="flex items-center">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No notifications found
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border bg-white hover:shadow-md transition-shadow ${
                getNotificationBorder(notification.type, notification.priority)
              } ${!notification.isRead ? 'bg-blue-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                      </h4>
                      {!notification.isRead && (
                        <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                      {notification.priority === 'critical' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Critical
                        </span>
                      )}
                      {notification.priority === 'high' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                          High
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center text-xs text-gray-500 space-x-4">
                      <div className="flex items-center">
                        <FiClock className="h-3 w-3 mr-1" />
                        {notification.timestamp.toDate().toLocaleString()}
                      </div>
                      <span>Source: {notification.source}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {notification.actionUrl && notification.actionText && (
                    <button
                      onClick={() => window.open(notification.actionUrl, '_blank')}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {notification.actionText}
                    </button>
                  )}
                  {!notification.isRead && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Mark as read"
                    >
                      <FiCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => markAsArchived(notification.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Archive"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination could be added here */}
      <div className="mt-6 flex items-center justify-between text-sm text-gray-600">
        <div>
          Showing {filteredNotifications.length} of {notifications.length} notifications
        </div>
        <div>
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
