package com.modulo.ui.notes.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.modulo.database.entity.NoteEntity
import com.modulo.databinding.ItemNoteBinding
import com.modulo.utils.DateUtils

/**
 * RecyclerView adapter for displaying notes list
 */
class NotesAdapter(
    private val onNoteClick: (NoteEntity) -> Unit,
    private val onNoteLongClick: (NoteEntity) -> Unit
) : ListAdapter<NoteEntity, NotesAdapter.NoteViewHolder>(NoteDiffCallback()) {
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): NoteViewHolder {
        val binding = ItemNoteBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return NoteViewHolder(binding)
    }
    
    override fun onBindViewHolder(holder: NoteViewHolder, position: Int) {
        holder.bind(getItem(position))
    }
    
    inner class NoteViewHolder(
        private val binding: ItemNoteBinding
    ) : RecyclerView.ViewHolder(binding.root) {
        
        fun bind(note: NoteEntity) {
            binding.apply {
                textViewTitle.text = note.title
                textViewContent.text = note.content
                textViewDate.text = DateUtils.formatRelativeTime(note.updatedAt)
                
                // Show sync status indicator
                updateSyncStatusIndicator(note.syncStatus)
                
                // Set click listeners
                root.setOnClickListener { onNoteClick(note) }
                root.setOnLongClickListener { 
                    onNoteLongClick(note)
                    true
                }
            }
        }
        
        private fun updateSyncStatusIndicator(syncStatus: NoteEntity.SyncStatus) {
            binding.apply {
                when (syncStatus) {
                    NoteEntity.SyncStatus.SYNCED -> {
                        syncStatusIndicator.visibility = android.view.View.GONE
                    }
                    NoteEntity.SyncStatus.PENDING_SYNC -> {
                        syncStatusIndicator.visibility = android.view.View.VISIBLE
                        syncStatusIndicator.setImageResource(android.R.drawable.ic_dialog_info)
                        syncStatusIndicator.setColorFilter(
                            android.content.res.ContextCompat.getColor(
                                root.context,
                                android.R.color.holo_orange_dark
                            )
                        )
                    }
                    NoteEntity.SyncStatus.SYNC_ERROR -> {
                        syncStatusIndicator.visibility = android.view.View.VISIBLE
                        syncStatusIndicator.setImageResource(android.R.drawable.ic_dialog_alert)
                        syncStatusIndicator.setColorFilter(
                            android.content.res.ContextCompat.getColor(
                                root.context,
                                android.R.color.holo_red_dark
                            )
                        )
                    }
                    NoteEntity.SyncStatus.PENDING_DELETION -> {
                        syncStatusIndicator.visibility = android.view.View.VISIBLE
                        syncStatusIndicator.setImageResource(android.R.drawable.ic_delete)
                        syncStatusIndicator.setColorFilter(
                            android.content.res.ContextCompat.getColor(
                                root.context,
                                android.R.color.darker_gray
                            )
                        )
                        // Make item appear dimmed
                        root.alpha = 0.6f
                    }
                }
            }
        }
    }
}

/**
 * DiffUtil callback for efficient list updates
 */
class NoteDiffCallback : DiffUtil.ItemCallback<NoteEntity>() {
    
    override fun areItemsTheSame(oldItem: NoteEntity, newItem: NoteEntity): Boolean {
        return oldItem.id == newItem.id
    }
    
    override fun areContentsTheSame(oldItem: NoteEntity, newItem: NoteEntity): Boolean {
        return oldItem == newItem
    }
}
