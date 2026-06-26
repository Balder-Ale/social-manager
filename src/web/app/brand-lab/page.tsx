'use client';

import { useState, ChangeEvent, FormEvent } from 'react';

export default function BrandLab() {
  const [brandName, setBrandName] = useState('');
  const [tone, setTone] = useState('');
  const [palette, setPalette] = useState<string[]>(['', '', '', '']); // up to 4 colors
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [guidelines, setGuidelines] = useState('');

  const handlePaletteChange = (index: number, value: string) => {
    const newPalette = [...palette];
    newPalette[index] = value;
    setPalette(newPalette);
  };

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const payload = {
      name: brandName,
      tone,
      palette: palette.filter(c => c),
      guidelines,
      logoUrl: null,
      tenantId: null
    };

    try {
      const res = await fetch('http://localhost:4001/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create brand');
      }

      const brand = await res.json();
      console.log('Brand created:', brand);
      alert(`Brand "${brand.name}" created successfully!`);

      // Reset form
      setBrandName('');
      setTone('');
      setPalette(['', '', '', '']);
      setLogoFile(null);
      setGuidelines('');
    } catch (err: any) {
      console.error('Error creating brand:', err);
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-black p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Brand Lab</h1>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4"
      >
        {/* Brand Name */}
        <div>
          <label htmlFor="brandName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Brand Name
          </label>
          <input
            id="brandName"
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        {/* Tone */}
        <div>
          <label htmlFor="tone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tone / Voice
          </label>
          <input
            id="tone"
            type="text"
            placeholder="e.g., friendly, professional"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Color Palette */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Color Palette (hex values)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {palette.map((color, idx) => (
              <input
                key={idx}
                type="color"
                value={color}
                onChange={(e) => handlePaletteChange(idx, e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600"
              />
            ))}
          </div>
        </div>

        {/* Logo Upload */}
        <div>
          <label htmlFor="logo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Logo
          </label>
          <input
            id="logo"
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
          />
          {logoFile && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Selected: {logoFile.name}</p>
          )}
        </div>

        {/* Guidelines */}
        <div>
          <label htmlFor="guidelines" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Brand Guidelines (optional)
          </label>
          <textarea
            id="guidelines"
            rows={4}
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Save Brand
          </button>
        </div>
      </form>
    </div>
  );
}
