import React, { useState } from 'react';
import { FiX, FiSave, FiList, FiImage } from 'react-icons/fi';
import { resizeImage, createImagePreview } from '@/lib/utils/imageUtils';

export interface CategoryFormData {
  name: string;
  description?: string;
  parent?: string | null;
  imageFile?: File | null;
}

interface AddNewCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (categoryData: CategoryFormData) => void;
  categories?: Array<{ id: string; name: string; parent?: string | null }>; // Available categories for parent selection
}

const AddNewCategoryModal: React.FC<AddNewCategoryModalProps> = ({ isOpen, onClose, onSave, categories = [] }) => {
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [parentCategory, setParentCategory] = useState('none');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  // Get only top-level categories for parent selection
  const topLevelCategories = categories.filter(cat => !cat.parent);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    try {
      setIsUploading(true);
      
      // Resize image to 100x100 for categories as requested
      const resizedFile = await resizeImage(file, {
        maxWidth: 100,
        maxHeight: 100,
        quality: 0.8
      });

      // Create preview
      const preview = await createImagePreview(resizedFile);
      
      setImageFile(resizedFile);
      setImagePreview(preview);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      alert('Category name cannot be empty.');
      return;
    }
    onSave({
      name: categoryName,
      description: description.trim() || undefined,
      parent: parentCategory === 'none' ? null : parentCategory,
      imageFile
    });
    // Reset fields after save
    resetForm();
  };

  const resetForm = () => {
    setCategoryName('');
    setDescription('');
    setParentCategory('none');
    setImageFile(null);
    setImagePreview(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            <FiList className="text-xl text-teal-600 mr-2" /> {/* Changed icon color */}
            <h3 className="text-lg font-semibold text-gray-800">Add New Category</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={20} />
          </button>
        </div>        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="categoryNameInput" className="block text-sm font-medium text-gray-700 mb-1">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="categoryNameInput"
                name="categoryName"
                required
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Enter category name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="categoryDescriptionInput" className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                id="categoryDescriptionInput"
                name="categoryDescription"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a short description for the category"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="parentCategorySelect" className="block text-sm font-medium text-gray-700 mb-1">
                Parent Category
              </label>
              <select
                id="parentCategorySelect"
                name="parentCategory"
                value={parentCategory}
                onChange={(e) => setParentCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="none">None (Top-Level Category)</option>
                {topLevelCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Image Upload Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Image (Optional)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                <div className="space-y-1 text-center">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Category image preview"
                        className="mx-auto h-20 w-20 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  ) : (
                    <FiImage className="mx-auto h-12 w-12 text-gray-400" />
                  )}
                  
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="categoryImageUpload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-teal-600 hover:text-teal-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-teal-500"
                    >
                      <span>{imageFile ? 'Change image' : 'Upload an image'}</span>
                      <input
                        id="categoryImageUpload"
                        name="categoryImageUpload"
                        type="file"
                        className="sr-only"
                        accept="image/*"
                        onChange={handleImageChange}
                        disabled={isUploading}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, GIF up to 5MB (will be resized to 100x100)
                  </p>
                  {isUploading && (
                    <p className="text-xs text-blue-500">Processing image...</p>
                  )}
                </div>
              </div>
            </div>
          </div>          <div className="flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 flex items-center disabled:opacity-50"
            >
              <FiSave className="mr-2" /> 
              {isUploading ? 'Processing...' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNewCategoryModal;
