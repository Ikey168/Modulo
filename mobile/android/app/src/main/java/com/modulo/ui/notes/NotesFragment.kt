package com.modulo.ui.notes

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.modulo.R
import com.modulo.databinding.FragmentNotesBinding
import com.modulo.ui.notes.adapter.NotesAdapter

/**
 * Fragment displaying list of notes
 * Shows all user notes with offline/sync status
 */
class NotesFragment : Fragment() {
    
    private var _binding: FragmentNotesBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var viewModel: NotesViewModel
    private lateinit var notesAdapter: NotesAdapter
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentNotesBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        // TODO: Replace with proper dependency injection
        viewModel = ViewModelProvider(this)[NotesViewModel::class.java]
        
        setupRecyclerView()
        setupSwipeRefresh()
        observeViewModel()
    }
    
    private fun setupRecyclerView() {
        notesAdapter = NotesAdapter(
            onNoteClick = { note ->
                // Navigate to note detail
                val action = NotesFragmentDirections.actionNavNotesToNoteDetail(note.id)
                findNavController().navigate(action)
            },
            onNoteLongClick = { note ->
                // Show context menu or delete option
                showNoteContextMenu(note)
            }
        )
        
        binding.recyclerViewNotes.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = notesAdapter
            setHasFixedSize(true)
        }
    }
    
    private fun setupSwipeRefresh() {
        binding.swipeRefreshLayout.setOnRefreshListener {
            viewModel.syncNotes()
        }
    }
    
    private fun observeViewModel() {
        viewModel.notes.observe(viewLifecycleOwner) { notes ->
            notesAdapter.submitList(notes)
            
            // Show/hide empty state
            if (notes.isEmpty()) {
                binding.recyclerViewNotes.visibility = View.GONE
                binding.emptyStateLayout.visibility = View.VISIBLE
            } else {
                binding.recyclerViewNotes.visibility = View.VISIBLE
                binding.emptyStateLayout.visibility = View.GONE
            }
        }
        
        viewModel.syncStatus.observe(viewLifecycleOwner) { status ->
            binding.swipeRefreshLayout.isRefreshing = status.isLoading
            
            // Update sync status indicator
            updateSyncStatusIndicator(status)
        }
        
        viewModel.errorMessage.observe(viewLifecycleOwner) { message ->
            if (message != null) {
                showError(message)
                viewModel.clearError()
            }
        }
    }
    
    private fun showNoteContextMenu(note: com.modulo.database.entity.NoteEntity) {
        // TODO: Implement context menu with edit/delete options
        // For now, just navigate to edit
        val action = NotesFragmentDirections.actionNavNotesToNoteDetail(note.id)
        findNavController().navigate(action)
    }
    
    private fun updateSyncStatusIndicator(status: SyncStatus) {
        // TODO: Update sync status indicator in UI
        // Show sync progress, errors, offline state, etc.
    }
    
    private fun showError(message: String) {
        // TODO: Show error snackbar or dialog
        com.google.android.material.snackbar.Snackbar
            .make(binding.root, message, com.google.android.material.snackbar.Snackbar.LENGTH_LONG)
            .show()
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

/**
 * Sync status for UI updates
 */
data class SyncStatus(
    val isLoading: Boolean = false,
    val lastSyncTime: Long? = null,
    val pendingCount: Int = 0,
    val errorCount: Int = 0,
    val isOnline: Boolean = true
)
