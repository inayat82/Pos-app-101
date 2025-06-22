import React, { useState, useEffect } from 'react';
import { FiX, FiSave, FiList, FiUpload, FiImage } from 'react-icons/fi';
import { resizeImageFile, validateImageFile } from '@/lib/utils/imageUtils';

export interface CategoryFormData {
  name: string;
  description?: string;
  parent?: string | null;
  imageUrl?: string | null;
  imagePath?: string | null;
  imageFile?: File | null;
}

interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (categoryId: string, categoryData: CategoryFormData) => void;
  category: { id: string; name: string; description?: string; parent?: string | null; imageUrl?: string | null; imagePath?: string | null } | null;
  categories?: Array<{ id: string; name: string }>; 
}

const EditCategoryModal: React.FC<EditCategoryModalProps> = ({ isOpen, onClose, onSave, category, categories = [] }) => {
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [parentCategory, setParentCategory] = useState('none');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (category) {
      setCategoryName(category.name);
      setDescription(category.description || '');
      setParentCategory(category.parent || 'none');
      setCurrentImageUrl(category.imageUrl || null);
      setImagePreview(null);
      setSelectedImage(null);
    } else {
      setCategoryName('');
      setDescription('');
      setParentCategory('none');
      setCurrentImageUrl(null);
      setImagePreview(null);
      setSelectedImage(null);
    }
  }, [category]);

  if (!isOpen || !category) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Validate the image file
      validateImageFile(file);
      
      // Resize image for categories (100x100)
      const resizedFile = await resizeImageFile(file, 100, 100);
      setSelectedImage(resizedFile);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(resizedFile);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error processing image');
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setCurrentImageUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      alert('Category name cannot be empty.');
      return;
    }

    setIsUploading(true);    try {
      onSave(category.id, {
        name: categoryName,
        description: description.trim() || undefined,
        parent: parentCategory === 'none' ? null : parentCategory,
        imageUrl: currentImageUrl,
        imagePath: category.imagePath,
        imageFile: selectedImage
      });
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            <FiList className="text-xl text-teal-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Edit Category</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={20} />
          </button>
        </div>        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="editCategoryNameInput" className="block text-sm font-medium text-gray-700 mb-1">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="editCategoryNameInput"
                name="categoryName"
                required
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Enter category name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="editCategoryDescriptionInput" className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                id="editCategoryDescriptionInput"
                name="categoryDescription"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a short description for the category"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Image Upload Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Image (Optional)
              </label>
              
              {/* Current Image or Preview */}
              <div className="mb-3">
                {imagePreview || currentImageUrl ? (
                  <div className="relative w-24 h-24 border-2 border-gray-300 rounded-lg overflow-hidden">
                    <img
                      src={imagePreview || currentImageUrl || ''}
                      alt="Category preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <FiImage className="text-gray-400 text-xl" />
                  </div>
                )}
              </div>

              {/* File Input */}
              <div className="flex items-center">
                <input
                  type="file"
                  id="editCategoryImageInput"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <label
                  htmlFor="editCategoryImageInput"
                  className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FiUpload className="mr-2" />
                  {imagePreview ? 'Change Image' : 'Upload Image'}
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Image will be resized to 100x100 pixels. Supports JPG, PNG, GIF up to 5MB
              </p>
            </div>
            
            <div>
              <label htmlFor="editParentCategorySelect" className="block text-sm font-medium text-gray-700 mb-1">
                Parent Category
              </label>
              <select
                id="editParentCategorySelect"
                name="parentCategory"
                value={parentCategory}
                onChange={(e) => setParentCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="none">None (Top-Level Category)</option>
                {categories
                  .filter(cat => cat.id !== category?.id) // Exclude current category
                  .map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 flex items-center disabled:opacity-50"
            >
              <FiSave className="mr-2" /> 
              {isUploading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCategoryModal;
