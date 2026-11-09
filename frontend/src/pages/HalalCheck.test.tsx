import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import HalalCheck from './HalalCheck';

jest.mock('../components/PageSEO', () => () => null);

let lastScanCallback: ((result: any, error?: any, controls?: any) => void) | null = null;
const mockControls = { stop: jest.fn() };

// Mock @zxing/browser
jest.mock('@zxing/browser', () => {
  return {
    __esModule: true,
    BrowserMultiFormatReader: class {
      decodeFromStream = jest.fn().mockImplementation((_stream: any, _video: any, callback: any) => {
        lastScanCallback = callback;
        return Promise.resolve(mockControls);
      });
    },
  };
});

describe('HalalCheck component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastScanCallback = null;
    global.fetch = jest.fn();
    window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  });

  it('renders heading and barcode input field', () => {
    render(<HalalCheck />);
    expect(screen.getByText('Read before you eat.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 737628064502')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^check$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan with camera/i })).toBeInTheDocument();
  });

  it('validates barcode length before fetching', async () => {
    render(<HalalCheck />);
    const input = screen.getByPlaceholderText('e.g. 737628064502');
    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter an 8 to 14 digit barcode.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches and displays product details on valid barcode lookup', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        data: {
          barcode: '737628064502',
          productName: 'Organic Whole Milk',
          brands: ['Dairy Valley'],
          ingredients: ['Organic Pasteurized Milk'],
          ingredientsText: 'Organic Pasteurized Milk',
          allergens: ['Milk'],
          labels: ['Organic'],
          images: { front: 'https://example.com/milk.jpg' },
          halalLabelListed: true,
          source: { name: 'OpenFoodFacts', url: 'https://openfoodfacts.org', license: 'ODbL' },
        },
      }),
    });

    render(<HalalCheck />);
    const input = screen.getByPlaceholderText('e.g. 737628064502');
    fireEvent.change(input, { target: { value: '737628064502' } });
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }));

    expect(await screen.findByText('Organic Whole Milk')).toBeInTheDocument();
    expect(screen.getByText('Dairy Valley')).toBeInTheDocument();
    expect(screen.getByText(/Halal label listed in source data/i)).toBeInTheDocument();
  });

  it('starts camera scanning when Scan with camera is clicked', async () => {
    const mockTrack = { stop: jest.fn() };
    const mockStream = {
      getTracks: () => [mockTrack],
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
    });

    render(<HalalCheck />);
    fireEvent.click(screen.getByRole('button', { name: /scan with camera/i }));

    await waitFor(() => {
      expect(screen.getByText(/align barcode within box/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^stop$/i })).toBeInTheDocument();
    });

    // Stop scanning
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('automatically captures scanned barcode, updates input, stops camera, and triggers lookup', async () => {
    const mockTrack = { stop: jest.fn() };
    const mockStream = {
      getTracks: () => [mockTrack],
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        data: {
          barcode: '8901030383742',
          productName: 'Halal Whole Grain Oats',
          brands: ['Pure Harvest'],
          ingredients: ['Whole Rolled Oats'],
          ingredientsText: 'Whole Rolled Oats',
          allergens: [],
          labels: ['Halal'],
          images: {},
          halalLabelListed: true,
          source: { name: 'OpenFoodFacts', url: 'https://openfoodfacts.org', license: 'ODbL' },
        },
      }),
    });

    render(<HalalCheck />);
    fireEvent.click(screen.getByRole('button', { name: /scan with camera/i }));

    await waitFor(() => {
      expect(lastScanCallback).not.toBeNull();
    });

    // Simulate detection of barcode inside act
    act(() => {
      lastScanCallback?.({ getText: () => '8901030383742' }, undefined, mockControls);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. 737628064502')).toHaveValue('8901030383742');
      expect(screen.getByText('Halal Whole Grain Oats')).toBeInTheDocument();
      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });
});
