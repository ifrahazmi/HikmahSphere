import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import {
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  PaperAirplaneIcon,
  EnvelopeIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { API_URL } from '../config';

type ContactFormData = {
  name: string;
  email: string;
  type: 'Support' | 'Bug' | 'Suggestion' | 'Correction' | 'Other';
  message: string;
};

const Contact: React.FC = () => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContactFormData>();
  const [success, setSuccess] = useState(false);

  const onSubmit = async (data: ContactFormData) => {
    try {
      const response = await fetch(`${API_URL}/support/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        reset();
        toast.success('Message sent successfully!');
        setTimeout(() => setSuccess(false), 5000);
      } else {
        toast.error(result.message || 'Failed to send message');
      }
    } catch (error) {
      console.error(error);
      toast.error('Something went wrong. Please try again.');
    }
  };

  const contactOptions = [
    {
      type: 'Support',
      icon: ChatBubbleLeftRightIcon,
      title: 'General Support',
      desc: 'Need help with using the platform?'
    },
    {
      type: 'Bug',
      icon: ExclamationTriangleIcon,
      title: 'Report a Bug',
      desc: 'Something not working as expected?'
    },
    {
      type: 'Suggestion',
      icon: LightBulbIcon,
      title: 'Feature Suggestion',
      desc: 'Have an idea to improve HikmahSphere?'
    },
    {
      type: 'Correction',
      icon: CheckCircleIcon,
      title: 'Content Correction',
      desc: 'Found an error in our Islamic content?'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Contact & Support
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            We value your feedback. Whether it's a suggestion, a bug report, or a correction, we're here to listen.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden md:flex">
          {/* Left Side - Info */}
          <div className="bg-emerald-600 p-8 md:w-1/3 text-white flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-6">Get in Touch</h3>
              <p className="mb-8 text-emerald-100">
                Your input helps us build a better platform for the Ummah. We try to respond to all inquiries within 24-48 hours.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <EnvelopeIcon className="h-6 w-6 text-emerald-200 mt-1 mr-3" />
                  <div>
                    <p className="font-medium">Email Us</p>
                    <a href="mailto:ifrahazmi@hikmahsphere.site" className="text-emerald-100 hover:text-white transition-colors">
                      ifrahazmi@hikmahsphere.site
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12">
              <p className="text-sm text-emerald-200">
                "The believer to the believer is like a solid building, one part supports the other."
                <br />
                <span className="italic opacity-75">- Sahih al-Bukhari</span>
              </p>
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="p-8 md:w-2/3 bg-white">
            {success ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircleIcon className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Message Sent!</h3>
                <p className="text-gray-600">
                  JazakAllah Khair for contacting us. We have received your message and will get back to you soon.
                </p>
                <button 
                  onClick={() => setSuccess(false)}
                  className="mt-6 text-emerald-600 font-medium hover:text-emerald-700 underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      {...register('name', { required: 'Name is required' })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                        errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="Enter your name"
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      {...register('email', { 
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address"
                        }
                      })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                        errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="your@email.com"
                    />
                    {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                    Inquiry Type
                  </label>
                  <select
                    id="type"
                    {...register('type', { required: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                  >
                    <option value="Support">General Support</option>
                    <option value="Bug">Report a Bug</option>
                    <option value="Suggestion">Feature Suggestion</option>
                    <option value="Correction">Content Correction</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    {...register('message', { required: 'Message is required' })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                      errors.message ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="How can we help you?"
                  />
                  {errors.message && <p className="mt-1 text-xs text-red-500">{errors.message.message}</p>}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <PaperAirplaneIcon className="h-5 w-5 mr-2 -rotate-45" />
                        Send Message
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        
        {/* Quick Info Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {contactOptions.map((option, idx) => (
            <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                <option.icon className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{option.title}</h4>
              <p className="text-sm text-gray-500">{option.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Contact;
