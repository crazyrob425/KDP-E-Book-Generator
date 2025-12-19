

import React, { useState, useEffect } from 'react';
import { AuthorProfile, BookOutline, MarketReport } from '../types';
import Button from './shared/Button';
import Card from './shared/Card';
import { UploadIcon, XIcon, LinkedInIcon, GlobeAltIcon, SparklesIcon, TrashIcon, MegaphoneIcon } from './icons';
import LoadingSpinner from './shared/LoadingSpinner';
import * as geminiService from '../services/geminiService';

interface AuthorProfileModalProps {
  profile: AuthorProfile | null;
  onSave: (profile: AuthorProfile) => void;
  onClose: () => void;
  bookOutline: BookOutline | null;
  marketReport: MarketReport | null;
}

const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve({ base64: reader.result as string, mimeType: file.type });
    reader.onerror = error => reject(error);
  });
};

const AuthorProfileModal: React.FC<AuthorProfileModalProps> = ({ profile, onSave, onClose, bookOutline, marketReport }) => {
  const [formData, setFormData] = useState<AuthorProfile>({
    name: '',
    contact: '',
    bio: '',
    expertise: '',
    birthday: '',
    socialMedia: {
        twitter: '',
        linkedin: '',
        website: '',
        facebook: '',
        instagram: ''
    },
    marketing: {
        ctaText: 'Join my newsletter for exclusive content!',
        ctaUrl: '',
        includeInEpub: true
    },
    photo: null,
    actionPhoto: null,
    criticReviews: [],
    autoGenerate: false,
  });
  
  const [isReimagining, setIsReimagining] = useState(false);
  const [isQuickWriting, setIsQuickWriting] = useState(false);
  const [activeTab, setActiveTab] = useState<'basics' | 'media' | 'reviews' | 'marketing'>('basics');

  useEffect(() => {
    if (profile) {
      // Ensure complex objects are initialized if migrating from older state
      setFormData({
          ...profile,
          socialMedia: profile.socialMedia || { twitter: '', linkedin: '', website: '', facebook: '', instagram: '' },
          marketing: profile.marketing || { ctaText: 'Join my newsletter for exclusive content!', ctaUrl: profile.socialMedia?.website || '', includeInEpub: true },
          criticReviews: profile.criticReviews || [],
          actionPhoto: profile.actionPhoto || null
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSocialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, socialMedia: {...prev.socialMedia, [name]: value} }));
  };

  const handleMarketingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value, type, checked } = e.target;
      setFormData(prev => ({ 
          ...prev, 
          marketing: {
              ...(prev.marketing || { ctaText: '', ctaUrl: '', includeInEpub: false }),
              [name]: type === 'checkbox' ? checked : value
          }
      }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = e.target;
      setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleFile = async (file: File | null, field: 'photo' | 'actionPhoto') => {
    if (file && file.type.startsWith('image/')) {
        const photoData = await fileToBase64(file);
        setFormData(prev => ({ ...prev, [field]: photoData }));
    }
  };

  const handleReviewChange = (index: number, field: 'source' | 'quote', value: string) => {
      const newReviews = [...formData.criticReviews];
      newReviews[index] = { ...newReviews[index], [field]: value };
      setFormData(prev => ({ ...prev, criticReviews: newReviews }));
  };

  const addReview = () => {
      if (formData.criticReviews.length < 4) {
          setFormData(prev => ({ ...prev, criticReviews: [...prev.criticReviews, { source: '', quote: '' }] }));
      }
  };

  const removeReview = (index: number) => {
      setFormData(prev => ({ ...prev, criticReviews: prev.criticReviews.filter((_, i) => i !== index) }));
  };

  const handleQuickWrite = async () => {
    if (!formData.bio && !formData.expertise) {
        alert("Please enter at least a rough draft in the Bio or Expertise fields for the AI to enhance.");
        return;
    }
    
    setIsQuickWriting(true);
    try {
        const enhancedData = await geminiService.quickEnhanceAuthorProfile(formData);
        setFormData(prev => ({
            ...prev,
            ...enhancedData
        }));
    } catch (e) {
        console.error("Quick Write failed", e);
        alert("Failed to quick-write content. Please try again.");
    } finally {
        setIsQuickWriting(false);
    }
  };

  const handleReImagine = async () => {
    if (!bookOutline) {
        alert("Please ensure a book outline is generated before re-imagining the author.");
        return;
    }
    setIsReimagining(true);
    try {
        const reimaginedProfile = await geminiService.reimagineAuthorPersona(
            formData,
            bookOutline.title,
            bookOutline.subtitle,
            'Non-Fiction/General', // Simplified for now, could be inferred
            marketReport
        );
        setFormData(prev => ({
            ...reimaginedProfile,
            marketing: prev.marketing // Preserve marketing settings
        }));
    } catch (e) {
        console.error("Failed to re-imagine author", e);
        alert("Failed to generate AI persona. Please try again.");
    } finally {
        setIsReimagining(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
      <Card 
        className="w-full max-w-4xl bg-slate-800 border-violet-500/50 max-h-[90vh] overflow-hidden flex flex-col p-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
            <div>
                <h2 className="text-2xl font-bold text-violet-400 font-serif">Author Profile Editor</h2>
                <p className="text-sm text-slate-400">Configure your public persona</p>
            </div>
            {bookOutline && (
                <Button onClick={handleReImagine} disabled={isReimagining} className="animate-pulse-slow">
                    {isReimagining ? <LoadingSpinner size="sm" message="Re-Imagining..." /> : <><SparklesIcon className="w-5 h-5" /> Re-Imagine with AI</>}
                </Button>
            )}
        </div>

        <div className="flex border-b border-slate-700 overflow-x-auto">
            <button onClick={() => setActiveTab('basics')} className={`flex-1 py-3 px-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'basics' ? 'bg-slate-700 text-white border-b-2 border-violet-500' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>Basics & Bio</button>
            <button onClick={() => setActiveTab('media')} className={`flex-1 py-3 px-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'media' ? 'bg-slate-700 text-white border-b-2 border-violet-500' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>Photos & Socials</button>
            <button onClick={() => setActiveTab('reviews')} className={`flex-1 py-3 px-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'reviews' ? 'bg-slate-700 text-white border-b-2 border-violet-500' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>Critic Reviews</button>
            <button onClick={() => setActiveTab('marketing')} className={`flex-1 py-3 px-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'marketing' ? 'bg-slate-700 text-white border-b-2 border-violet-500' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>Marketing & CTA</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-6">
            
            {activeTab === 'basics' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-700/30 p-4 rounded-lg border border-violet-500/30 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-violet-300 flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4" /> 
                                AI Quick Write
                            </h3>
                            <p className="text-xs text-slate-400">
                                Enter rough notes below, then click this to turn them into a masterpiece.
                            </p>
                        </div>
                        <Button 
                            type="button" 
                            onClick={handleQuickWrite} 
                            disabled={isQuickWriting}
                            variant="secondary"
                            className="text-xs bg-violet-600/20 hover:bg-violet-600/40 border-violet-500/50"
                        >
                            {isQuickWriting ? <LoadingSpinner size="sm" message="Writing..." /> : 'Auto-Enhance Bio & Expertise'}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Author Name</label>
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md" placeholder="e.g., Jane Doe" />
                        </div>
                        <div>
                            <label htmlFor="birthday" className="block text-sm font-medium text-slate-300 mb-1">Birthday</label>
                            <input type="text" id="birthday" name="birthday" value={formData.birthday} onChange={handleChange} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md" placeholder="e.g., April 1, 1980" />
                        </div>
                        <div className="md:col-span-2">
                             <label htmlFor="contact" className="block text-sm font-medium text-slate-300 mb-1">Contact Email</label>
                             <input type="text" id="contact" name="contact" value={formData.contact} onChange={handleChange} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md" placeholder="contact@example.com" />
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="bio" className="block text-sm font-medium text-slate-300 mb-1">About the Author (Bio)</label>
                        <textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} rows={6} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md resize-y" placeholder="Tell the readers your story..." />
                    </div>
                    
                    <div>
                        <label htmlFor="expertise" className="block text-sm font-medium text-slate-300 mb-1">Book-Specific Expertise</label>
                        <textarea id="expertise" name="expertise" value={formData.expertise} onChange={handleChange} rows={3} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md resize-y" placeholder="Why are you the authority on this topic?" />
                    </div>
                </div>
            )}

            {activeTab === 'media' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Headshot */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 text-center mb-2">Primary Headshot</label>
                             <div className="relative group w-full aspect-square bg-slate-700 rounded-md border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden">
                                {formData.photo ? (
                                    <>
                                        <img src={formData.photo.base64} alt="Headshot" className="w-full h-full object-cover" />
                                        <label htmlFor="photo" className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            Change
                                            <input id="photo" type="file" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0] || null, 'photo')} accept="image/*" />
                                        </label>
                                    </>
                                ) : (
                                    <label htmlFor="photo" className="cursor-pointer flex flex-col items-center">
                                        <UploadIcon className="w-8 h-8 text-slate-400 mb-2" />
                                        <span className="text-xs text-slate-400">Upload Headshot</span>
                                        <input id="photo" type="file" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0] || null, 'photo')} accept="image/*" />
                                    </label>
                                )}
                            </div>
                        </div>

                         {/* Action Photo */}
                         <div>
                            <label className="block text-sm font-medium text-slate-300 text-center mb-2">Lifestyle/Action Shot</label>
                            <p className="text-xs text-slate-500 text-center mb-2">For back cover (e.g., hiking, writing)</p>
                             <div className="relative group w-full aspect-square bg-slate-700 rounded-md border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden">
                                {formData.actionPhoto ? (
                                    <>
                                        <img src={formData.actionPhoto.base64} alt="Action Shot" className="w-full h-full object-cover" />
                                        <label htmlFor="actionPhoto" className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            Change
                                            <input id="actionPhoto" type="file" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0] || null, 'actionPhoto')} accept="image/*" />
                                        </label>
                                    </>
                                ) : (
                                    <label htmlFor="actionPhoto" className="cursor-pointer flex flex-col items-center">
                                        <UploadIcon className="w-8 h-8 text-slate-400 mb-2" />
                                        <span className="text-xs text-slate-400">Upload Action Shot</span>
                                        <input id="actionPhoto" type="file" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0] || null, 'actionPhoto')} accept="image/*" />
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Social Media Links</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <XIcon className="w-5 h-5 text-slate-400" />
                                <input type="text" name="twitter" value={formData.socialMedia.twitter} onChange={handleSocialChange} placeholder="Twitter / X" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm" />
                            </div>
                            <div className="flex items-center gap-2">
                                <LinkedInIcon className="w-5 h-5 text-slate-400" />
                                <input type="text" name="linkedin" value={formData.socialMedia.linkedin} onChange={handleSocialChange} placeholder="LinkedIn" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm" />
                            </div>
                            <div className="flex items-center gap-2">
                                <GlobeAltIcon className="w-5 h-5 text-slate-400" />
                                <input type="text" name="website" value={formData.socialMedia.website} onChange={handleSocialChange} placeholder="Website" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 text-slate-400 font-bold text-center">f</span>
                                <input type="text" name="facebook" value={formData.socialMedia.facebook} onChange={handleSocialChange} placeholder="Facebook" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm" />
                            </div>
                             <div className="flex items-center gap-2">
                                <span className="w-5 h-5 text-slate-400 font-bold text-center">Ig</span>
                                <input type="text" name="instagram" value={formData.socialMedia.instagram} onChange={handleSocialChange} placeholder="Instagram" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'reviews' && (
                <div className="space-y-6 animate-fade-in">
                    <p className="text-sm text-slate-400">Add up to 4 critic reviews to appear on the book cover or marketing material.</p>
                    {formData.criticReviews.map((review, index) => (
                        <div key={index} className="bg-slate-700/50 p-4 rounded-md border border-slate-600 relative">
                            <button type="button" onClick={() => removeReview(index)} className="absolute top-2 right-2 text-slate-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                            <label className="block text-xs text-slate-400 mb-1">Source / Publication</label>
                            <input type="text" value={review.source} onChange={(e) => handleReviewChange(index, 'source', e.target.value)} className="w-full px-3 py-1 bg-slate-800 border border-slate-600 rounded-md text-sm mb-2" placeholder="e.g. The New York Times" />
                            
                            <label className="block text-xs text-slate-400 mb-1">Quote</label>
                            <textarea value={review.quote} onChange={(e) => handleReviewChange(index, 'quote', e.target.value)} rows={2} className="w-full px-3 py-1 bg-slate-800 border border-slate-600 rounded-md text-sm resize-none" placeholder="e.g. A thrilling ride from start to finish..." />
                        </div>
                    ))}
                    {formData.criticReviews.length < 4 && (
                        <Button type="button" onClick={addReview} variant="secondary" className="w-full border-dashed border-2 border-slate-600 bg-transparent hover:bg-slate-700">
                            + Add Critic Review
                        </Button>
                    )}
                </div>
            )}

            {activeTab === 'marketing' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-900/50 p-6 rounded-lg border border-emerald-500/30">
                        <div className="flex items-center gap-3 mb-4">
                            <MegaphoneIcon className="w-6 h-6 text-emerald-400" />
                            <h3 className="text-lg font-bold text-white">Call-to-Action (CTA) Button</h3>
                        </div>
                        <p className="text-sm text-slate-300 mb-6">
                            Embed a clickable button at the end of every chapter in your ebook. This is crucial for building your mailing list or selling more books.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="ctaText" className="block text-sm font-medium text-slate-300 mb-1">Button Text</label>
                                <input 
                                    type="text" 
                                    id="ctaText" 
                                    name="ctaText" 
                                    value={formData.marketing?.ctaText || ''} 
                                    onChange={handleMarketingChange} 
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-md focus:ring-2 focus:ring-emerald-500" 
                                    placeholder="e.g., Join my newsletter & get a free book!" 
                                />
                            </div>
                            <div>
                                <label htmlFor="ctaUrl" className="block text-sm font-medium text-slate-300 mb-1">Link URL</label>
                                <input 
                                    type="url" 
                                    id="ctaUrl" 
                                    name="ctaUrl" 
                                    value={formData.marketing?.ctaUrl || ''} 
                                    onChange={handleMarketingChange} 
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-md focus:ring-2 focus:ring-emerald-500" 
                                    placeholder="https://www.yourwebsite.com/newsletter" 
                                />
                                {formData.socialMedia?.website && !formData.marketing?.ctaUrl && (
                                    <button 
                                        type="button"
                                        onClick={() => setFormData(prev => ({...prev, marketing: {...prev.marketing!, ctaUrl: prev.socialMedia.website!}}))}
                                        className="text-xs text-violet-400 hover:underline mt-1"
                                    >
                                        Use website from profile
                                    </button>
                                )}
                            </div>
                            <div className="pt-2">
                                <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-md border border-slate-700 cursor-pointer hover:border-slate-500 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        name="includeInEpub" 
                                        checked={formData.marketing?.includeInEpub || false} 
                                        onChange={handleMarketingChange} 
                                        className="w-5 h-5 text-emerald-500 rounded focus:ring-emerald-500 bg-slate-700 border-slate-500"
                                    />
                                    <span className="text-sm font-medium text-slate-200">Include this button in the generated EPUB file</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-4 border-t border-slate-700">
                <label htmlFor="autoGenerate" className="flex items-center">
                    <input
                        type="checkbox"
                        id="autoGenerate"
                        name="autoGenerate"
                        checked={formData.autoGenerate}
                        onChange={handleCheckboxChange}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="ml-3 text-sm text-slate-300">
                        <span className="font-semibold">Enable AI Persona Mode</span>
                        <p className="text-xs text-slate-400">Allow AI to automatically regenerate this persona for future books to match their specific topics.</p>
                    </span>
                </label>
            </div>
        </form>
        
        <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-4">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit}>Save Profile</Button>
        </div>
      </Card>
    </div>
  );
};

export default AuthorProfileModal;