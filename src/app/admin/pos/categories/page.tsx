// filepath: c:\\Users\\USER-PC\\My Drive\\Sync App\\Ai\\Project\\app-101\\pos-app\\src\\app\\admin\\pos\\categories\\page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiSearch, FiEdit, FiTrash2 } from 'react-icons/fi';
import AddNewCategoryModal, { CategoryFormData as AddCategoryFormData } from '@/components/admin/AddNewCategoryModal';
import EditCategoryModal, { CategoryFormData as EditCategoryFormData } from '@/components/admin/EditCategoryModal'; // Import EditCategoryModal
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { Category as CategoryType } from '@/types/pos'; // Import Category from centralized types

// Define a type for your category data, extending the core CategoryType
interface PageCategory extends CategoryType {
  description?: string;
  parent?: string | null;
  createdAt?: any; 
}

const ProductCategoriesPage = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PageCategory | null>(null);
  const [categories, setCategories] = useState<PageCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { currentUser } = useAuth();

  const handleOpenAddModal = () => setIsAddModalOpen(true);
  const handleCloseAddModal = () => setIsAddModalOpen(false);

  const handleOpenEditModal = (category: PageCategory) => {
    setSelectedCategory(category);
    setIsEditModalOpen(true);
  };
  const handleCloseEditModal = () => {
    setSelectedCategory(null);
    setIsEditModalOpen(false);
  };

  const fetchCategories = useCallback(() => {
    if (currentUser?.uid) {
      setIsLoading(true);
      setError(null);
      const categoriesColRef = collection(db, 'admins', currentUser.uid, 'categories');
      const q = query(categoriesColRef, orderBy('name', 'asc'));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedCategories: PageCategory[] = [];
        querySnapshot.forEach((doc) => {
          fetchedCategories.push({ id: doc.id, ...doc.data(), adminId: currentUser.uid } as PageCategory);
        });
        setCategories(fetchedCategories);
        setIsLoading(false);
      }, (err) => {
        console.error("Error fetching categories: ", err);
        setError("Failed to load categories. Please try again.");
        setIsLoading(false);
      });
      return unsubscribe;
    } else {
      setCategories([]);
      setIsLoading(false);
      return () => {};
    }
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = fetchCategories();
    return () => unsubscribe();
  }, [fetchCategories]);
  const handleSaveCategory = async (categoryData: AddCategoryFormData) => {
    if (!currentUser?.uid) {
      setError("You must be logged in to add a category.");
      return;
    }
    setError(null);
    try {
      let imageUrl = '';
      let imagePath = '';      // Upload image if provided
      if (categoryData.imageFile) {
        const formData = new FormData();
        formData.append('file', categoryData.imageFile);
        formData.append('adminId', currentUser.uid);
        formData.append('uploadType', 'categories');

        const uploadResponse = await fetch('/api/admin/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload image');
        }

        const uploadResult = await uploadResponse.json();
        imageUrl = uploadResult.imageUrl;
        imagePath = uploadResult.storagePath;
      }

      const categoriesColRef = collection(db, 'admins', currentUser.uid, 'categories');
      await addDoc(categoriesColRef, {
        name: categoryData.name,
        description: categoryData.description,
        parent: categoryData.parent || null,
        imageUrl: imageUrl || undefined,
        imagePath: imagePath || undefined,
        createdAt: serverTimestamp(),
      });
      handleCloseAddModal();
    } catch (err: any) {
      console.error("Error adding category to Firestore: ", err);
      setError(err.message || "Failed to save category. Please try again.");
    }
  };
  const handleUpdateCategory = async (categoryId: string, categoryData: EditCategoryFormData) => {
    if (!currentUser?.uid) {
      setError("You must be logged in to update a category.");
      return;
    }
    setError(null);
    try {
      let imageUrl = categoryData.imageUrl;
      let imagePath = categoryData.imagePath;

      // Upload image if provided
      if (categoryData.imageFile) {
        const formData = new FormData();
        formData.append('file', categoryData.imageFile);
        formData.append('adminId', currentUser.uid);
        formData.append('uploadType', 'categories');

        const uploadResponse = await fetch('/api/admin/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload image');
        }

        const uploadResult = await uploadResponse.json();
        imageUrl = uploadResult.imageUrl;
        imagePath = uploadResult.storagePath;
      }

      const categoryDocRef = doc(db, 'admins', currentUser.uid, 'categories', categoryId);
      await updateDoc(categoryDocRef, {
        name: categoryData.name,
        description: categoryData.description,
        parent: categoryData.parent || null,
        imageUrl: imageUrl,
        imagePath: imagePath,
        updatedAt: serverTimestamp(),
      });
      handleCloseEditModal();
    } catch (err) {
      console.error("Error updating category in Firestore: ", err);
      setError("Failed to update category. Please try again.");
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!currentUser?.uid) {
      setError("You must be logged in to delete a category.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this category? This action cannot be undone.")) {
        return;
    }
    setError(null);
    try {
      const categoryDocRef = doc(db, 'admins', currentUser.uid, 'categories', categoryId);
      await deleteDoc(categoryDocRef);
    } catch (err) {
      console.error("Error deleting category from Firestore: ", err);
      setError("Failed to delete category. Please try again.");
    }
  };

  const filteredCategories = categories.filter(category => 
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // TODO: Implement logic to display parent category name if applicable

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Product Categories</h1>
        <button
          onClick={handleOpenAddModal}
          disabled={!currentUser}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiPlus className="mr-2" /> Add New Category
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md shadow" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex items-center">
          <FiSearch className="text-gray-500 mr-3 h-5 w-5" />
          <input
            type="text"
            placeholder="Search categories by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-lg overflow-hidden">        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
              <th className="py-3 px-6 text-left">Image</th>
              <th className="py-3 px-6 text-left">Category Name</th>
              <th className="py-3 px-6 text-left">Description</th>
              {/* <th className="py-3 px-6 text-left">Parent Category</th> */}
              <th className="py-3 px-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {isLoading && (
              <tr>
                <td colSpan={4} className="text-center py-10 text-gray-500">Loading categories...</td>
              </tr>
            )}
            {!isLoading && !error && filteredCategories.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-10 text-gray-500">
                   {searchTerm ? 'No categories match your search.' : 'No categories found. Click "Add New Category" to add one.'}
                </td>
              </tr>
            )}
            {!isLoading && !error && filteredCategories.map((category) => (
              <tr key={category.id} className="border-b border-gray-200 hover:bg-gray-100">
                <td className="py-4 px-6 text-left">
                  <div className="w-12 h-12 flex items-center justify-center rounded-lg overflow-hidden bg-gray-100">
                    {category.imageUrl ? (
                      <img 
                        src={category.imageUrl} 
                        alt={category.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className={`w-full h-full flex items-center justify-center text-gray-400 text-xs ${category.imageUrl ? 'hidden' : 'flex'}`}
                    >
                      No Image
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6 text-left whitespace-nowrap">{category.name}</td>
                <td className="py-4 px-6 text-left">{category.description || 'N/A'}</td>
                {/* <td className="py-4 px-6 text-left">{category.parent ? 'Parent Name Here' : 'N/A'}</td> */}
                <td className="py-4 px-6 text-center">
                  <button 
                    onClick={() => handleOpenEditModal(category)}
                    className="text-blue-600 hover:text-blue-800 mr-2 p-1"
                    title="Edit Category"
                    >
                    <FiEdit size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeleteCategory(category.id)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Delete Category"
                    >
                    <FiTrash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>      <AddNewCategoryModal 
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        onSave={handleSaveCategory}
        categories={categories} 
      />
      {selectedCategory && (
        <EditCategoryModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSave={handleUpdateCategory}
          category={selectedCategory}
          categories={categories}
        />
      )}
    </div>
  );
};

export default ProductCategoriesPage;
